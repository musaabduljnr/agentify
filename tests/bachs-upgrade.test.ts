import { beforeEach, describe, expect, it, vi } from "vitest";
import { activateSubscriptionPlan, resolvePlanFromProductId } from "@/lib/billing/upgrade";
import { getEffectivePlanLimits } from "@/lib/billing/platform";
import { createServiceClient } from "@/utils/supabase/service";

const fixtures = vi.hoisted(() => ({
  transaction: {
    id: "tx-growth",
    business_id: "biz-456",
    plan: "growth",
    provider: "bachs",
    status: "pending",
    checkout_id: "chk-growth",
    reference: "agentify-growth-reference",
    raw_response: {
      product_id: "prod-growth",
      user_id: "usr-123",
      business_id: "biz-456",
      plan: "growth",
    },
  },
  business: {
    id: "biz-456",
    owner_id: "usr-123",
    name: "Test Corp",
    contact_email: null,
  },
  rpc: vi.fn(),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/billing/platform", () => ({
  getEffectivePlanConfig: vi.fn(async (plan: "starter" | "growth") => ({
    name: plan === "growth" ? "Growth" : "Starter",
    price_usd: plan === "growth" ? 10 : 2,
    amount_decimal: plan === "growth" ? "10.00" : "2.00",
    bachs_product_id: plan === "growth" ? "prod-growth" : "prod-starter",
  })),
  getEffectivePlanLimits: vi.fn(async (plan: "starter" | "growth") => ({
    message_limit: plan === "growth" ? 1500 : 200,
    knowledge_limit: plan === "growth" ? 100 : 25,
    lead_limit: plan === "growth" ? 999999999 : 50,
    widget_limit: plan === "growth" ? 3 : 1,
    embedding_limit: plan === "growth" ? 50000 : 5000,
    daily_message_limit: 999999999,
    team_member_limit: plan === "growth" ? 3 : 1,
  })),
}));

vi.mock("@/lib/email/send-email", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/config/platform-config", () => ({
  getConfig: vi.fn().mockResolvedValue("https://agentifychat.online"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function createMockServiceClient() {
  return {
    from: vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data: table === "payment_transactions" ? fixtures.transaction : fixtures.business,
          error: null,
        })),
      };
      return query;
    }),
    rpc: fixtures.rpc,
  };
}

describe("Bachs subscription activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.transaction.plan = "growth";
    fixtures.transaction.checkout_id = "chk-growth";
    fixtures.transaction.reference = "agentify-growth-reference";
    fixtures.transaction.raw_response = {
      product_id: "prod-growth",
      user_id: "usr-123",
      business_id: "biz-456",
      plan: "growth",
    };
    fixtures.business.owner_id = "usr-123";
    fixtures.rpc.mockResolvedValue({
      data: { plan: "growth", subscription_id: "sub-row-1", duplicate: false },
      error: null,
    });
    vi.mocked(createServiceClient).mockReturnValue(createMockServiceClient() as never);
  });

  it("resolves plans only from configured Bachs products", async () => {
    expect(await resolvePlanFromProductId("prod-growth")).toBe("growth");
    expect(await resolvePlanFromProductId("prod-starter")).toBe("starter");
    expect(await resolvePlanFromProductId("unknown-product")).toBeNull();
  });

  it("applies a verified Starter-to-Growth upgrade with Growth limits through the atomic RPC", async () => {
    const result = await activateSubscriptionPlan({
      eventId: "evt-1",
      eventTimestamp: "2026-11-01T11:00:00.000Z",
      checkoutId: "chk-growth",
      reference: "agentify-growth-reference",
      productId: "prod-growth",
      customerId: "cus-1",
      subscriptionId: "sub-1",
      amount: "10.00",
      currency: "USD",
      sourceEvent: "collection.succeeded",
    });

    expect(result).toEqual({
      success: true,
      businessId: "biz-456",
      plan: "growth",
      subscriptionId: "sub-row-1",
      duplicate: false,
    });
    expect(fixtures.rpc).toHaveBeenCalledWith(
      "apply_bachs_checkout_payment",
      expect.objectContaining({
        p_event_id: "evt-1",
        p_transaction_id: "tx-growth",
        p_product_id: "prod-growth",
        p_amount: 10,
        p_currency: "USD",
        p_limits: expect.objectContaining({ widget_limit: 3, message_limit: 1500 }),
      })
    );
    expect(getEffectivePlanLimits).toHaveBeenCalledWith("growth");
  });

  it("rejects a checkout ID paired with another transaction reference", async () => {
    await expect(
      activateSubscriptionPlan({
        eventId: "evt-mismatch",
        eventTimestamp: "2026-11-01T11:00:00.000Z",
        checkoutId: "chk-growth",
        reference: "wrong-reference",
        amount: "10.00",
        currency: "USD",
        sourceEvent: "checkout.completed",
      })
    ).rejects.toThrow("No Agentify checkout transaction matches");

    expect(fixtures.rpc).not.toHaveBeenCalled();
  });

  it("rejects mismatched amount, product, or business owner before activation", async () => {
    const validParams = {
      eventId: "evt-2",
      eventTimestamp: "2026-11-01T11:00:00.000Z",
      checkoutId: "chk-growth",
      reference: "agentify-growth-reference",
      productId: "prod-growth",
      amount: "10.00",
      currency: "USD",
      sourceEvent: "checkout.completed" as const,
    };

    await expect(
      activateSubscriptionPlan({ ...validParams, amount: "2.00" })
    ).rejects.toThrow("amount does not match");
    await expect(
      activateSubscriptionPlan({ ...validParams, productId: "prod-starter" })
    ).rejects.toThrow("product does not match");

    fixtures.business.owner_id = "different-user";
    await expect(activateSubscriptionPlan(validParams)).rejects.toThrow("business owner");
    expect(fixtures.rpc).not.toHaveBeenCalled();
  });
});
