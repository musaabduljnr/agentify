import { describe, it, expect, vi, beforeEach } from "vitest";
import { activateSubscriptionPlan, resolvePlanFromProductId } from "@/lib/billing/upgrade";
import { createServiceClient } from "@/utils/supabase/service";

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/email/send-email", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/config/platform-config", () => ({
  getConfig: vi.fn().mockResolvedValue("https://agentify.app"),
}));

describe("Bachs Subscription Upgrade Engine", () => {
  const mockBusinessId = "biz-456";
  const mockUserId = "usr-123";
  const mockCheckoutId = "cs_test_growth_789";
  const mockCustomerId = "cust_bachs_999";
  const mockSubscriptionId = "sub_bachs_888";

  let mockSubscriptionsTable: Record<string, any>;
  let mockTransactionsTable: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BACHS_GROWTH_PRODUCT_ID = "prod_growth_test";
    process.env.BACHS_STARTER_PRODUCT_ID = "prod_starter_test";

    // Initial state: user is on Starter plan
    mockSubscriptionsTable = {
      id: "sub-record-1",
      business_id: mockBusinessId,
      plan: "starter",
      status: "pending",
      payment_provider: "bachs",
      message_limit: 200,
      knowledge_limit: 25,
      lead_limit: 50,
      widget_limit: 1,
      embedding_limit: 5000,
      updated_at: "2026-11-01T10:00:00.000Z",
    };

    mockTransactionsTable = {
      id: "tx-1",
      business_id: mockBusinessId,
      checkout_id: mockCheckoutId,
      plan: "growth",
      amount: 10,
      currency: "USD",
      status: "pending",
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((col: string, val: string) => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscriptionsTable, error: null }),
              })),
              or: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscriptionsTable, error: null }),
              })),
            })),
            update: vi.fn((updates: any) => ({
              eq: vi.fn((col: string, val: string) => {
                Object.assign(mockSubscriptionsTable, updates);
                return Promise.resolve({ data: mockSubscriptionsTable, error: null });
              }),
            })),
            insert: vi.fn((data: any) => {
              mockSubscriptionsTable = { id: "sub-new", ...data };
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: mockSubscriptionsTable, error: null }),
                })),
              };
            }),
          };
        }

        if (table === "payment_transactions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((col: string, val: string) => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockTransactionsTable, error: null }),
              })),
            })),
            update: vi.fn((updates: any) => ({
              eq: vi.fn((col: string, val: string) => {
                Object.assign(mockTransactionsTable, updates);
                return Promise.resolve({ data: mockTransactionsTable, error: null });
              }),
            })),
            insert: vi.fn((data: any) => Promise.resolve({ data, error: null })),
          };
        }

        if (table === "businesses") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockBusinessId, name: "Test Corp", contact_email: "test@corp.com" },
                  error: null,
                }),
              })),
            })),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any);
  });

  it("should resolve plan from product ID correctly", async () => {
    expect(await resolvePlanFromProductId("prod_growth_test")).toBe("growth");
    expect(await resolvePlanFromProductId("prod_starter_test")).toBe("starter");
    expect(await resolvePlanFromProductId("unknown_prod")).toBe(null);
  });

  it("should upgrade a Starter user to Growth plan with verified quotas", async () => {
    const result = await activateSubscriptionPlan({
      businessId: mockBusinessId,
      userId: mockUserId,
      plan: "growth",
      customerId: mockCustomerId,
      subscriptionId: mockSubscriptionId,
      checkoutId: mockCheckoutId,
      amount: 10,
      sourceEvent: "collection.succeeded",
    });

    expect(result.success).toBe(true);
    expect(result.plan).toBe("growth");
    expect(result.isUpgraded).toBe(true);

    // Verify subscription was upgraded to growth
    expect(mockSubscriptionsTable.plan).toBe("growth");
    expect(mockSubscriptionsTable.status).toBe("active");
    expect(mockSubscriptionsTable.bachs_customer_id).toBe(mockCustomerId);
    expect(mockSubscriptionsTable.bachs_subscription_id).toBe(mockSubscriptionId);
    expect(mockSubscriptionsTable.billing_amount).toBe(10);
    expect(mockSubscriptionsTable.billing_currency).toBe("USD");

    // Verify Growth limits were applied immediately (1500 messages, 3 widgets, 100 knowledge sources)
    expect(mockSubscriptionsTable.message_limit).toBe(1500);
    expect(mockSubscriptionsTable.widget_limit).toBe(3);
    expect(mockSubscriptionsTable.knowledge_limit).toBe(100);

    // Verify transaction status changed to success
    expect(mockTransactionsTable.status).toBe("success");
    expect(mockTransactionsTable.plan).toBe("growth");
  });

  it("should handle collection.succeeded arriving before checkout.completed cleanly", async () => {
    // 1. collection.succeeded arrives first
    const firstResult = await activateSubscriptionPlan({
      checkoutId: mockCheckoutId,
      chargeId: "ch_test_123",
      amount: 10,
      customerId: mockCustomerId,
      subscriptionId: mockSubscriptionId,
      eventTimestamp: "2026-11-01T11:00:00.000Z",
      sourceEvent: "collection.succeeded",
    });

    expect(firstResult.success).toBe(true);
    expect(firstResult.plan).toBe("growth");
    expect(mockSubscriptionsTable.plan).toBe("growth");
    expect(mockSubscriptionsTable.status).toBe("active");

    // 2. checkout.completed arrives second
    const secondResult = await activateSubscriptionPlan({
      businessId: mockBusinessId,
      checkoutId: mockCheckoutId,
      plan: "growth",
      customerId: mockCustomerId,
      subscriptionId: mockSubscriptionId,
      amount: 10,
      eventTimestamp: "2026-11-01T11:00:01.000Z",
      sourceEvent: "checkout.completed",
    });

    expect(secondResult.success).toBe(true);
    expect(secondResult.plan).toBe("growth");
    expect(mockSubscriptionsTable.plan).toBe("growth");
  });

  it("should not allow an older Starter event to downgrade an active Growth subscription", async () => {
    // Current state is Growth at 11:05
    mockSubscriptionsTable.plan = "growth";
    mockSubscriptionsTable.status = "active";
    mockSubscriptionsTable.updated_at = "2026-11-01T11:05:00.000Z";

    // Delayed old event from 10:55 arrived saying starter
    const result = await activateSubscriptionPlan({
      businessId: mockBusinessId,
      plan: "starter",
      amount: 2,
      eventTimestamp: "2026-11-01T10:55:00.000Z",
      sourceEvent: "customer.subscription.updated",
    });

    expect(result.success).toBe(true);
    // Should preserve Growth and NOT regress to Starter
    expect(result.plan).toBe("growth");
    expect(mockSubscriptionsTable.plan).toBe("growth");
  });

  it("should resolve plan to Growth when checkoutId matches a growth transaction", async () => {
    // Event doesn't explicitly pass plan, but transaction has plan = growth
    const result = await activateSubscriptionPlan({
      checkoutId: mockCheckoutId,
      amount: 10,
      customerId: mockCustomerId,
      sourceEvent: "collection.succeeded",
    });

    expect(result.success).toBe(true);
    expect(result.plan).toBe("growth");
    expect(mockSubscriptionsTable.plan).toBe("growth");
  });
});
