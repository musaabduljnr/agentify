import { beforeEach, describe, expect, it, vi } from "vitest";
import { reserveUsageQuota } from "@/lib/billing/usage";

const fixtures = vi.hoisted(() => ({
  subscription: null as Record<string, unknown> | null,
  configs: {
    starter: {
      messages: 200,
      daily_messages: null,
      knowledge_sources: 25,
      leads: 50,
      widgets: 1,
      embeddings: 5000,
      team_members: 1,
    },
    growth: {
      messages: 1500,
      daily_messages: null,
      knowledge_sources: 100,
      leads: null,
      widgets: 3,
      embeddings: 50000,
      team_members: 3,
    },
    enterprise: {
      messages: null,
      daily_messages: null,
      knowledge_sources: null,
      leads: null,
      widgets: null,
      embeddings: null,
      team_members: null,
    },
  },
  used: {} as Record<string, number>,
  reserved: {} as Record<string, number>,
  completedMessages: [] as Array<{ amount: number; created_at: string; type: string }>,
  rpcMock: vi.fn(),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: fixtures.subscription, error: null }),
      };
      return builder;
    },
    rpc: fixtures.rpcMock,
  }),
}));

vi.mock("@/lib/billing/platform", () => ({
  getEffectivePlanConfig: async (plan: keyof typeof fixtures.configs) =>
    fixtures.configs[plan],
}));

function configureSubscription(plan: "starter" | "growth") {
  const now = new Date();
  fixtures.subscription = {
    id: "sub-1",
    business_id: "business-1",
    plan,
    status: "active",
    current_period_start: now.toISOString(),
    current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: now.toISOString(),
  };
}

async function attempt(
  plan: "starter" | "growth",
  type: "message" | "assistant" | "knowledge_source" | "lead",
  used: number
) {
  configureSubscription(plan);
  fixtures.used[type] = used;
  fixtures.reserved[type] = 0;
  return reserveUsageQuota("business-1", type);
}

describe("business-level quota boundaries", () => {
  beforeEach(() => {
    fixtures.subscription = null;
    fixtures.used = {};
    fixtures.reserved = {};
    fixtures.completedMessages = [];
    fixtures.rpcMock.mockImplementation(async (_functionName, args) => {
      const type = args.p_type as string;
      const key = type === "widget_chat" ? "message" : type;
      const plan = fixtures.subscription?.plan as keyof typeof fixtures.configs;
      const limit = fixtures.configs[plan][
        key === "message"
          ? "messages"
          : key === "assistant"
            ? "widgets"
            : key === "knowledge_source"
              ? "knowledge_sources"
              : key === "lead"
                ? "leads"
                : "embeddings"
      ];
      const periodStart = String(fixtures.subscription?.current_period_start || "");
      const loggedMessages = key === "message"
        ? fixtures.completedMessages
            .filter((log) =>
              ["message", "widget_chat"].includes(log.type) &&
              log.created_at >= periodStart
            )
            .reduce((sum, log) => sum + log.amount, 0)
        : 0;
      const used = Math.max(fixtures.used[key] || 0, loggedMessages);
      const reserved = fixtures.reserved[key] || 0;
      if (limit !== null && limit < 999999999 && used + reserved + args.p_amount > limit) {
        return { data: { allowed: false, reason: "monthly_limit" }, error: null };
      }

      fixtures.reserved[key] = reserved + args.p_amount;
      return {
        data: { allowed: true, operation_id: args.p_operation_id },
        error: null,
      };
    });
  });

  it("enforces Starter's 200-reply cycle cap at 199, 200, and 201", async () => {
    expect((await attempt("starter", "message", 199)).reservation).not.toBeNull();
    expect(await attempt("starter", "message", 200)).toMatchObject({
      reservation: null,
      reason: "monthly_limit",
    });
    expect(await attempt("starter", "message", 201)).toMatchObject({
      reservation: null,
      reason: "monthly_limit",
    });
  });

  it("enforces Growth's 1,500-reply cycle cap at 1,499, 1,500, and 1,501", async () => {
    expect((await attempt("growth", "message", 1499)).reservation).not.toBeNull();
    expect(await attempt("growth", "message", 1500)).toMatchObject({
      reservation: null,
      reason: "monthly_limit",
    });
    expect(await attempt("growth", "message", 1501)).toMatchObject({
      reservation: null,
      reason: "monthly_limit",
    });
  });

  it("enforces Starter's assistant cap of one", async () => {
    expect((await attempt("starter", "assistant", 0)).reservation).not.toBeNull();
    expect(await attempt("starter", "assistant", 1)).toMatchObject({ reservation: null });
    expect(await attempt("starter", "assistant", 2)).toMatchObject({ reservation: null });
  });

  it("enforces Starter's 25 knowledge-source cap", async () => {
    expect((await attempt("starter", "knowledge_source", 24)).reservation).not.toBeNull();
    expect(await attempt("starter", "knowledge_source", 25)).toMatchObject({ reservation: null });
    expect(await attempt("starter", "knowledge_source", 26)).toMatchObject({ reservation: null });
  });

  it("enforces Starter's 50-lead cycle cap", async () => {
    expect((await attempt("starter", "lead", 49)).reservation).not.toBeNull();
    expect(await attempt("starter", "lead", 50)).toMatchObject({ reservation: null });
    expect(await attempt("starter", "lead", 51)).toMatchObject({ reservation: null });
  });

  it("enforces Growth's 100 knowledge-source cap", async () => {
    expect((await attempt("growth", "knowledge_source", 99)).reservation).not.toBeNull();
    expect(await attempt("growth", "knowledge_source", 100)).toMatchObject({ reservation: null });
    expect(await attempt("growth", "knowledge_source", 101)).toMatchObject({ reservation: null });
  });

  it("keeps Growth lead capture unlimited", async () => {
    expect((await attempt("growth", "lead", 1_000_000)).reservation).not.toBeNull();
  });

  it("serializes concurrent reservations at the Starter boundary", async () => {
    configureSubscription("starter");
    fixtures.used.message = 199;
    fixtures.reserved.message = 0;

    const results = await Promise.all([
      reserveUsageQuota("business-1", "message"),
      reserveUsageQuota("business-1", "widget_chat"),
    ]);

    expect(results.filter((result) => result.reservation).length).toBe(1);
    expect(results.filter((result) => !result.reservation)).toHaveLength(1);
  });

  it("starts counting from the current billing period, not dashboard refreshes", async () => {
    configureSubscription("starter");
    const now = new Date();
    fixtures.subscription!.current_period_start = now.toISOString();
    fixtures.completedMessages = [{
      type: "message",
      amount: 200,
      created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    }];

    expect((await reserveUsageQuota("business-1", "message")).reservation).not.toBeNull();
    expect(fixtures.subscription!.current_period_start).toBe(now.toISOString());
  });
});
