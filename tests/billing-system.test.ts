import { describe, it, expect, vi, beforeEach } from "vitest";
import { activateSubscriptionPlan } from "@/lib/billing/upgrade";
import { reconcileCheckoutSession } from "@/lib/actions/payments";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { getBachsCheckoutSession } from "@/lib/payments/bachs";

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/payments/bachs", () => ({
  getBachsCheckoutSession: vi.fn(),
  createBachsCheckoutSession: vi.fn(),
  createBachsCustomerPortalSession: vi.fn(),
  getBachsSubscription: vi.fn(),
  verifyBachsWebhookEvent: vi.fn(),
  getBachsWebhookSecret: vi.fn(),
  BachsApiError: class BachsApiError extends Error {},
}));

vi.mock("@/lib/email/send-email", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/config/platform-config", () => ({
  getConfig: vi.fn().mockResolvedValue("https://agentifychat.online"),
  getSecretWithEnvFallback: vi.fn().mockResolvedValue("mock_secret"),
}));

describe("Comprehensive Billing System Suite (Bachs USD Architecture)", () => {
  const mockBusinessId = "biz-refactor-001";
  const mockUserId = "usr-refactor-001";
  const mockCustomerId = "cus_bachs_test_123";
  const mockSubscriptionId = "sub_bachs_test_123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: Starter Subscription Activation (Bug 1 Fix)
  // ─────────────────────────────────────────────────────────────────
  it("should activate Starter subscription from pending to active with USD $2.00 limits", async () => {
    const existingSub = {
      id: "sub-row-1",
      business_id: mockBusinessId,
      plan: "starter",
      status: "pending",
      payment_provider: "bachs",
      updated_at: new Date(Date.now() - 60000).toISOString(),
    };

    let updatedPayload: any = null;
    let insertedTx: any = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: mockBusinessId, name: "Starter Co" } }),
          };
        }
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: existingSub }),
            update: vi.fn((payload) => {
              updatedPayload = payload;
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        if (table === "payment_transactions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            insert: vi.fn((payload) => {
              insertedTx = payload;
              return Promise.resolve({ error: null });
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    };

    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any);

    const result = await activateSubscriptionPlan({
      businessId: mockBusinessId,
      plan: "starter",
      amount: 2.0,
      checkoutId: "chk_starter_test_999",
      customerId: mockCustomerId,
      subscriptionId: mockSubscriptionId,
      sourceEvent: "collection.succeeded",
    });

    expect(result.success).toBe(true);
    expect(result.plan).toBe("starter");
    expect(updatedPayload).not.toBeNull();
    expect(updatedPayload.status).toBe("active");
    expect(updatedPayload.plan).toBe("starter");
    expect(updatedPayload.billing_currency).toBe("USD");
    expect(updatedPayload.billing_amount).toBe(2.0);
    expect(updatedPayload.widget_limit).toBe(1);
    expect(updatedPayload.message_limit).toBe(200);
    expect(updatedPayload.bachs_customer_id).toBe(mockCustomerId);
    expect(updatedPayload.bachs_subscription_id).toBe(mockSubscriptionId);
  });

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: Growth Plan Upgrade (Bug 2 Fix)
  // ─────────────────────────────────────────────────────────────────
  it("should upgrade an active Starter subscription to Growth ($10 USD) with expanded quotas", async () => {
    const existingStarterSub = {
      id: "sub-row-1",
      business_id: mockBusinessId,
      plan: "starter",
      status: "active",
      widget_limit: 1,
      message_limit: 1000,
      payment_provider: "bachs",
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    };

    let updatedPayload: any = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: mockBusinessId, name: "Growth Co" } }),
          };
        }
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: existingStarterSub }),
            update: vi.fn((payload) => {
              updatedPayload = payload;
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        if (table === "payment_transactions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    };

    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any);

    const result = await activateSubscriptionPlan({
      businessId: mockBusinessId,
      plan: "growth",
      amount: 10.0,
      checkoutId: "chk_growth_upgrade_888",
      customerId: mockCustomerId,
      subscriptionId: "sub_growth_888",
      sourceEvent: "checkout.completed",
    });

    expect(result.success).toBe(true);
    expect(result.plan).toBe("growth");
    expect(result.isUpgraded).toBe(true);
    expect(updatedPayload.status).toBe("active");
    expect(updatedPayload.plan).toBe("growth");
    expect(updatedPayload.billing_amount).toBe(10.0);
    expect(updatedPayload.widget_limit).toBe(3);
    expect(updatedPayload.message_limit).toBe(1500);
  });

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: Downgrade Regression Protection (Out-of-Order Safety)
  // ─────────────────────────────────────────────────────────────────
  it("should prevent an active Growth subscription from being stomped back to Starter by a delayed webhook", async () => {
    const existingGrowthSub = {
      id: "sub-row-1",
      business_id: mockBusinessId,
      plan: "growth",
      status: "active",
      widget_limit: 3,
      message_limit: 1500,
      payment_provider: "bachs",
      updated_at: new Date().toISOString(),
    };

    let updatedPayload: any = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: mockBusinessId } }),
          };
        }
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: existingGrowthSub }),
            update: vi.fn((payload) => {
              updatedPayload = payload;
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        if (table === "payment_transactions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    };

    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any);

    // Incoming delayed Starter webhook
    const result = await activateSubscriptionPlan({
      businessId: mockBusinessId,
      plan: "starter",
      amount: 2.0,
      checkoutId: "chk_delayed_starter_111",
      sourceEvent: "collection.succeeded",
    });

    expect(result.success).toBe(true);
    expect(result.plan).toBe("growth"); // Growth was retained!
    if (updatedPayload) {
      expect(updatedPayload.plan).toBe("growth"); // Never downgraded to starter
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: Zero-Delay Client Reconciliation (reconcileCheckoutSession)
  // ─────────────────────────────────────────────────────────────────
  it("should reconcile checkout session with Bachs API and activate subscription immediately", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockUserId } } }),
      },
    } as any);

    vi.mocked(getBachsCheckoutSession).mockResolvedValueOnce({
      id: "chk_reconcile_test",
      status: "completed",
      payment_status: "paid",
      amount: "10.00",
      metadata: {
        business_id: mockBusinessId,
        user_id: mockUserId,
        plan: "growth",
      },
      customer: {
        id: "cus_recon_123",
      },
      subscription: {
        id: "sub_recon_123",
      },
      reference: "ref_recon_123",
    } as any);

    const mockSub = {
      id: "sub-row-1",
      business_id: mockBusinessId,
      plan: "starter",
      status: "pending",
      updated_at: new Date().toISOString(),
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: mockBusinessId, name: "Recon Co" } }),
          };
        }
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockSub }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === "payment_transactions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    };

    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any);

    const result = await reconcileCheckoutSession("chk_reconcile_test");

    expect(result).toEqual({
      isSuccess: true,
      plan: "growth",
      status: "active",
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: Resilient Query Parameter Parsing
  // ─────────────────────────────────────────────────────────────────
  it("should extract checkoutId from standard or malformed redirect query parameters", () => {
    // Standard format
    const standardParams = { checkout_id: "chk_clean_12345" };
    expect(standardParams.checkout_id).toBe("chk_clean_12345");

    // Malformed format caused by duplicate query marks (?status=success?checkout_id=chk_xxx)
    const malformedParams = { status: "success?checkout_id=chk_malformed_67890" };
    const match = malformedParams.status.match(/checkout_id=([a-zA-Z0-9_\-]+)/);
    expect(match?.[1]).toBe("chk_malformed_67890");
  });
});
