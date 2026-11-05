import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession, verifyPaymentReference } from "@/lib/actions/payments";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createBachsCheckoutSession } from "@/lib/payments/bachs";
import { getEffectivePlanConfig } from "@/lib/billing/platform";

const fixtures = vi.hoisted(() => ({
  user: { id: "user-1", email: "user@example.com", user_metadata: { name: "Test User" } },
  business: {
    id: "biz-1",
    owner_id: "user-1",
    name: "Test Business",
    contact_email: "billing@example.com",
  },
  subscription: {
    id: "sub-row-1",
    business_id: "biz-1",
    plan: "starter",
    status: "pending",
    provider_customer_id: null,
    bachs_customer_id: null,
  },
  transaction: {
    id: "tx-1",
    business_id: "biz-1",
    reference: "ref-1",
    plan: "growth",
    status: "success",
  },
  insertedTransaction: null as Record<string, unknown> | null,
  createCheckout: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/payments/bachs", () => ({
  createBachsCheckoutSession: fixtures.createCheckout,
  createBachsCustomerPortalSession: vi.fn(),
  getBachsCheckoutSession: vi.fn(),
  BachsApiError: class BachsApiError extends Error {},
}));

vi.mock("@/lib/billing/platform", () => ({
  getEffectivePlanConfig: vi.fn(async (plan: "starter" | "growth") => ({
    name: plan === "growth" ? "Growth" : "Starter",
    price_usd: plan === "growth" ? 10 : 2,
    amount_decimal: plan === "growth" ? "10.00" : "2.00",
    bachs_product_id: plan === "growth" ? "prod-growth" : "prod-starter",
  })),
}));

vi.mock("@/lib/billing/upgrade", () => ({
  activateSubscriptionPlan: vi.fn(),
}));

vi.mock("@/lib/monitoring/log-error", () => ({
  getUserFriendlyError: vi.fn(() => "Payment could not be completed."),
  logErrorSync: vi.fn(),
}));

vi.mock("@/lib/config/platform-config", () => ({
  getConfig: vi.fn(async (_category: string, key: string) =>
    key === "enable_payments" ? "true" : "https://agentifychat.online"
  ),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function createServerClient(user: typeof fixtures.user | null = fixtures.user) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn((table: string) => {
      const data = table === "businesses" ? fixtures.business : fixtures.subscription;
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data, error: null })),
      };
      return query;
    }),
  };
}

function createServiceClientMock() {
  return {
    from: vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        not: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data: table === "payment_transactions" ? null : null,
          error: null,
        })),
        insert: vi.fn((payload: Record<string, unknown>) => {
          fixtures.insertedTransaction = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { id: "tx-pending" }, error: null }),
            })),
          };
        }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
      return query;
    }),
  };
}

describe("Bachs payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.insertedTransaction = null;
    vi.mocked(createClient).mockResolvedValue(createServerClient() as never);
    vi.mocked(createServiceClient).mockReturnValue(createServiceClientMock() as never);
    fixtures.createCheckout.mockImplementation(async (params: Record<string, unknown>) => {
      expect(fixtures.insertedTransaction).toMatchObject({
        business_id: "biz-1",
        plan: params.plan,
        currency: "USD",
        status: "pending",
      });
      return {
        checkoutId: "chk-1",
        checkoutUrl: "https://checkout.bachs.example/chk-1",
        status: "open",
      };
    });
  });

  it("persists a USD pending transaction before creating the Bachs checkout", async () => {
    const result = await createCheckoutSession("growth");

    expect(result).toEqual({ checkoutUrl: "https://checkout.bachs.example/chk-1" });
    expect(getEffectivePlanConfig).toHaveBeenCalledWith("growth");
    expect(fixtures.insertedTransaction).toMatchObject({
      business_id: "biz-1",
      plan: "growth",
      amount: 10,
      billing_amount: 10,
      currency: "USD",
      status: "pending",
      raw_response: expect.objectContaining({
        business_id: "biz-1",
        user_id: "user-1",
        product_id: "prod-growth",
      }),
    });
    expect(fixtures.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod-growth",
        businessId: "biz-1",
        userId: "user-1",
        plan: "growth",
      })
    );
  });

  it("does not create a checkout for an unauthenticated user", async () => {
    vi.mocked(createClient).mockResolvedValue(createServerClient(null) as never);

    const result = await createCheckoutSession("starter");

    expect(result).toMatchObject({ error: expect.stringContaining("Unauthorized") });
    expect(fixtures.createCheckout).not.toHaveBeenCalled();
  });

  it("returns payment status only for the authenticated business's reference", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({ data: fixtures.transaction, error: null })),
        };
        return query;
      }),
    } as never);

    const result = await verifyPaymentReference("ref-1");

    expect(result).toEqual({
      status: "success",
      plan: "growth",
      isPending: false,
      isSuccess: true,
      success: true,
    });
  });
});
