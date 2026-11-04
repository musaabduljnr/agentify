import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveBusinessEntitlements } from "@/lib/billing/entitlements";
import { reserveUsageQuota } from "@/lib/billing/usage";
import { createServiceClient } from "@/utils/supabase/service";

const mocks = vi.hoisted(() => ({
  subscriptionResult: {
    data: null as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  reservationResult: {
    data: { allowed: true, operation_id: "operation-1" } as Record<string, unknown>,
    error: null as { message: string } | null,
  },
  rpcMock: vi.fn(),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => mocks.subscriptionResult,
      };
      return builder;
    },
    rpc: mocks.rpcMock,
  }),
}));

vi.mock("@/lib/billing/platform", () => ({
  getEffectivePlanConfig: async (plan: string) => plan === "growth" ? ({
    messages: 1500,
    daily_messages: null,
    knowledge_sources: 100,
    leads: null,
    widgets: 3,
    embeddings: 50000,
    team_members: 3,
  }) : ({
    messages: 200,
    daily_messages: null,
    knowledge_sources: 25,
    leads: 50,
    widgets: 1,
    embeddings: 5000,
    team_members: 1,
  }),
}));

const activeStarterSubscription = {
  id: "sub-1",
  business_id: "business-1",
  plan: "starter",
  status: "active",
  message_limit: 5000,
  knowledge_limit: 1000,
  lead_limit: 1000,
  widget_limit: 5,
  embedding_limit: 5000,
  daily_message_limit: 999999999,
  team_member_limit: 1,
  current_period_end: "2099-01-01T00:00:00.000Z",
};

describe("subscription entitlements", () => {
  beforeEach(() => {
    mocks.subscriptionResult.data = null;
    mocks.subscriptionResult.error = null;
    mocks.reservationResult.data = { allowed: true, operation_id: "operation-1" };
    mocks.reservationResult.error = null;
    mocks.rpcMock.mockImplementation(async () => mocks.reservationResult);
    vi.clearAllMocks();
  });

  it("denies missing, pending, expired, and unknown-plan subscriptions", async () => {
    expect((await resolveBusinessEntitlements("business-1")).reason).toBe("no_subscription");

    mocks.subscriptionResult.data = { ...activeStarterSubscription, status: "pending" };
    expect((await resolveBusinessEntitlements("business-1")).reason).toBe("inactive_subscription");

    mocks.subscriptionResult.data = { ...activeStarterSubscription, status: "past_due" };
    expect((await resolveBusinessEntitlements("business-1")).reason).toBe("inactive_subscription");

    mocks.subscriptionResult.data = {
      ...activeStarterSubscription,
      current_period_end: "2000-01-01T00:00:00.000Z",
    };
    expect((await resolveBusinessEntitlements("business-1")).reason).toBe("expired_period");

    mocks.subscriptionResult.data = {
      ...activeStarterSubscription,
      current_period_end: null,
    };
    expect((await resolveBusinessEntitlements("business-1")).reason).toBe("expired_period");

    mocks.subscriptionResult.data = { ...activeStarterSubscription, plan: "unexpected" };
    expect((await resolveBusinessEntitlements("business-1")).reason).toBe("unknown_plan");
  });

  it("derives permissions and limits from a verified active subscription", async () => {
    mocks.subscriptionResult.data = activeStarterSubscription;

    const entitlements = await resolveBusinessEntitlements("business-1");

    expect(entitlements.active).toBe(true);
    expect(entitlements.canUseAi).toBe(true);
    expect(entitlements.canRemoveBranding).toBe(false);
    expect(entitlements.limits).toEqual({
      messages: 200,
      knowledgeSources: 25,
      assistants: 1,
      leads: 50,
      embeddings: 5000,
      teamMembers: 1,
      dailyMessages: 999999999,
    });
  });

  it("uses authoritative Growth limits instead of stale subscription columns", async () => {
    mocks.subscriptionResult.data = {
      ...activeStarterSubscription,
      plan: "growth",
      message_limit: 5000,
      knowledge_limit: 25,
      lead_limit: 1000,
      widget_limit: 1,
      embedding_limit: 5000,
      daily_message_limit: 50,
      team_member_limit: 1,
    };

    const entitlements = await resolveBusinessEntitlements("business-1");

    expect(entitlements.limits).toMatchObject({
      messages: 1500,
      knowledgeSources: 100,
      assistants: 3,
      leads: 999999999,
      embeddings: 50000,
      teamMembers: 3,
      dailyMessages: 999999999,
    });
    expect(entitlements.canRemoveBranding).toBe(true);
  });

  it("fails closed when the subscription lookup fails", async () => {
    mocks.subscriptionResult.error = { message: "database unavailable" };

    await expect(resolveBusinessEntitlements("business-1")).resolves.toMatchObject({
      active: false,
      reason: "lookup_failed",
    });
  });

  it("reserves quota through the atomic RPC and denies rejected reservations", async () => {
    mocks.subscriptionResult.data = activeStarterSubscription;
    const serviceClient = createServiceClient();
    mocks.reservationResult.data = { allowed: false, reason: "monthly_limit" };

    await expect(reserveUsageQuota("business-1", "message")).resolves.toEqual({
      reservation: null,
      reason: "monthly_limit",
    });
    expect(serviceClient.rpc).toHaveBeenCalledWith(
      "reserve_subscription_quota",
      expect.objectContaining({
        p_business_id: "business-1",
        p_type: "message",
        p_amount: 1,
      })
    );
  });

  it("fails closed when the atomic quota RPC errors", async () => {
    mocks.subscriptionResult.data = activeStarterSubscription;
    mocks.reservationResult.error = { message: "RPC unavailable" };

    await expect(reserveUsageQuota("business-1", "message")).rejects.toThrow(
      "Unable to verify subscription capacity."
    );
  });
});
