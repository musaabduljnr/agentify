import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileCheckoutSession } from "@/lib/actions/payments";
import { activateSubscriptionPlan } from "@/lib/billing/upgrade";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { getBachsCheckoutSession } from "@/lib/payments/bachs";

const fixtures = vi.hoisted(() => ({
  transaction: {
    id: "tx-1",
    business_id: "biz-1",
    plan: "growth",
    provider: "bachs",
    status: "pending",
    checkout_id: "chk-1",
    reference: "agentify-ref-1",
  },
  business: { id: "biz-1", owner_id: "user-1" },
  session: {
    checkout_id: "chk-1",
    status: "completed",
    payment_status: "paid",
    amount: "10.00",
    currency: "USD",
    reference: "agentify-ref-1",
    metadata: {
      plan: "growth",
      business_id: "biz-1",
      user_id: "user-1",
      product_id: "prod-growth",
    },
    product_cart: [{ product_id: "prod-growth" }],
    customer: { id: "cus-1" },
    subscription: { id: "sub-1" },
    charge: { id: "ch-1" },
    completed_at: "2026-11-01T11:00:00.000Z",
  },
  activate: vi.fn(),
  getCheckout: vi.fn(),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/payments/bachs", () => ({
  getBachsCheckoutSession: fixtures.getCheckout,
  createBachsCheckoutSession: vi.fn(),
  createBachsCustomerPortalSession: vi.fn(),
  BachsApiError: class BachsApiError extends Error {},
}));

vi.mock("@/lib/billing/upgrade", () => ({
  activateSubscriptionPlan: fixtures.activate,
}));

vi.mock("@/lib/monitoring/log-error", () => ({
  logErrorSync: vi.fn(),
  getUserFriendlyError: vi.fn(() => "Payment could not be completed."),
}));

vi.mock("@/lib/config/platform-config", () => ({
  getConfig: vi.fn().mockResolvedValue("https://agentify.app"),
  getSecretWithEnvFallback: vi.fn().mockResolvedValue(""),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function createQuery(data: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  return query;
}

describe("Bachs checkout reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.transaction.business_id = "biz-1";
    fixtures.transaction.checkout_id = "chk-1";
    fixtures.transaction.reference = "agentify-ref-1";
    fixtures.session.status = "completed";
    fixtures.session.payment_status = "paid";
    fixtures.session.reference = "agentify-ref-1";
    fixtures.session.amount = "10.00";
    fixtures.session.currency = "USD";
    fixtures.getCheckout.mockResolvedValue(fixtures.session);
    fixtures.activate.mockResolvedValue({
      success: true,
      businessId: "biz-1",
      plan: "growth",
      subscriptionId: "sub-row-1",
      duplicate: false,
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => createQuery(fixtures.business)),
    } as never);

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => createQuery(fixtures.transaction)),
    } as never);
  });

  it("reconciles only a provider-confirmed paid checkout", async () => {
    const result = await reconcileCheckoutSession("chk-1");

    expect(result).toEqual({ isSuccess: true, plan: "growth", status: "active" });
    expect(fixtures.activate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: null,
        checkoutId: "chk-1",
        reference: "agentify-ref-1",
        productId: "prod-growth",
        amount: "10.00",
        currency: "USD",
        sourceEvent: "checkout_reconciliation",
      })
    );
  });

  it("does not activate a completed checkout that collected no payment", async () => {
    fixtures.session.payment_status = "no_payment_required";

    const result = await reconcileCheckoutSession("chk-1");

    expect(result).toMatchObject({
      isSuccess: false,
      isPending: true,
      status: "completed",
      paymentStatus: "no_payment_required",
    });
    expect(fixtures.activate).not.toHaveBeenCalled();
  });

  it("does not retrieve or activate a checkout that is not owned by the business", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => createQuery(null)),
    } as never);

    const result = await reconcileCheckoutSession("chk-foreign");

    expect(result).toEqual({ error: "This checkout does not belong to your business." });
    expect(fixtures.getCheckout).not.toHaveBeenCalled();
    expect(fixtures.activate).not.toHaveBeenCalled();
  });
});
