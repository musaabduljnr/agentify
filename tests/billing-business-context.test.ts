import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBillingData } from "@/lib/actions/billing";

const fixtures = vi.hoisted(() => ({
  business: {
    id: "business-selected-by-dashboard",
    name: "GoBuyer",
    contact_email: "billing@example.com",
    phone: null,
    address: null,
    website_url: null,
  },
  getCurrentBusiness: vi.fn(),
  getCurrentPlan: vi.fn(),
  getUsageSummary: vi.fn(),
  transactionColumns: "",
}));

vi.mock("@/lib/queries/business", () => ({
  getCurrentBusiness: fixtures.getCurrentBusiness,
}));

vi.mock("@/lib/billing/subscription", () => ({
  getBusinessSubscription: vi.fn(),
  getCurrentPlan: fixtures.getCurrentPlan,
  getRemainingUsage: vi.fn(),
}));

vi.mock("@/lib/billing/usage", () => ({
  getUsageSummary: fixtures.getUsageSummary,
}));

vi.mock("@/lib/billing/platform", () => ({
  formatCurrencyAmount: vi.fn((amount: number | null) => `$${amount ?? "Custom"}`),
  getBillingPlatformSettings: vi.fn().mockResolvedValue({ currency: "USD" }),
  getEffectivePlanConfigs: vi.fn().mockResolvedValue({
    starter: { name: "Starter", price_usd: 2, features: [] },
    growth: { name: "Growth", price_usd: 10, features: [] },
    enterprise: { name: "Enterprise", price_usd: null, features: [] },
  }),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
      })),
    })),
  }),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => {
      const query = {
        select: vi.fn((columns: string) => {
          fixtures.transactionColumns = columns;
          return query;
        }),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        not: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      return query;
    }),
  })),
}));

vi.mock("@/lib/payments/bachs", () => ({
  getBachsCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/actions/payments", () => ({
  reconcileCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/monitoring/log-error", () => ({
  logErrorSync: vi.fn(),
}));

describe("billing business context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.transactionColumns = "";
    fixtures.getCurrentBusiness.mockResolvedValue(fixtures.business);
    fixtures.getCurrentPlan.mockResolvedValue({
      subscription: {
        id: "subscription-1",
        plan: "starter",
        status: "active",
        payment_provider: "bachs",
        provider_customer_id: null,
        provider_subscription_id: null,
        current_period_start: null,
        current_period_end: null,
        reset_date: null,
        cancel_at_period_end: false,
        metadata: {},
      },
      plan: { name: "Starter", price_usd: 2, widgets: 1 },
      planId: "starter",
    });
    fixtures.getUsageSummary.mockResolvedValue({
      messages: { used: 0, limit: 200, remaining: 200 },
      embeddings: { used: 0, limit: 5000, remaining: 5000 },
      leads: { used: 0, limit: 50, remaining: 50 },
      knowledge_sources: { used: 0, limit: 25, remaining: 25 },
    });
  });

  it("loads billing for the active dashboard business when the user has multiple businesses", async () => {
    const data = await getBillingData();

    expect(fixtures.getCurrentBusiness).toHaveBeenCalledOnce();
    expect(fixtures.getCurrentPlan).toHaveBeenCalledWith(fixtures.business.id);
    expect(fixtures.getUsageSummary).toHaveBeenCalledWith(fixtures.business.id);
    expect(fixtures.transactionColumns).toBe("id, plan, checkout_id, status");
    expect(fixtures.transactionColumns).not.toContain("failure_reason");
    expect(data).not.toBeNull();
    expect(data?.business.id).toBe(fixtures.business.id);
  });
});
