import "server-only";

import { createServiceClient } from "@/utils/supabase/service";
import { PLAN_CONFIG, type PlanId } from "@/lib/billing/plans";
import { getEffectivePlanConfig, getEffectivePlanLimits } from "@/lib/billing/platform";
import { logErrorSync } from "@/lib/monitoring/log-error";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { PaymentSuccessEmail } from "@/lib/email/templates/payment-success-email";
import { getConfig } from "@/lib/config/platform-config";
import { revalidatePath } from "next/cache";

type CheckoutTransaction = {
  id: string;
  business_id: string;
  plan: string;
  provider: string;
  status: string;
  checkout_id: string | null;
  reference: string;
  raw_response: Record<string, unknown> | null;
};

export interface ActivatePlanParams {
  eventId: string | null;
  eventTimestamp: string;
  checkoutId?: string | null;
  reference?: string | null;
  productId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  chargeId?: string | null;
  amount: string;
  currency: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  metadata?: Record<string, unknown>;
  sourceEvent: "collection.succeeded" | "checkout.completed" | "checkout_reconciliation";
}

export interface ActivatePlanResult {
  success: true;
  businessId: string;
  plan: "starter" | "growth";
  subscriptionId: string | null;
  duplicate: boolean;
}

function isPaidPlan(plan: string): plan is "starter" | "growth" {
  return plan === "starter" || plan === "growth";
}

export async function resolvePlanFromProductId(
  productId?: string | null
): Promise<"starter" | "growth" | null> {
  if (!productId) return null;

  const [starter, growth] = await Promise.all([
    getEffectivePlanConfig("starter"),
    getEffectivePlanConfig("growth"),
  ]);
  const starterProductId =
    starter.bachs_product_id || process.env.BACHS_STARTER_PRODUCT_ID?.trim() || null;
  const growthProductId =
    growth.bachs_product_id || process.env.BACHS_GROWTH_PRODUCT_ID?.trim() || null;

  if (productId === starterProductId) return "starter";
  if (productId === growthProductId) return "growth";
  return null;
}

async function findCheckoutTransaction(
  checkoutId?: string | null,
  reference?: string | null
): Promise<CheckoutTransaction | null> {
  const supabase = createServiceClient();
  const columns = "id, business_id, plan, provider, status, checkout_id, reference, raw_response";

  if (checkoutId) {
    const { data, error } = await supabase
      .from("payment_transactions")
      .select(columns)
      .eq("provider", "bachs")
      .eq("checkout_id", checkoutId)
      .maybeSingle();

    if (error) throw new Error(`Failed to find Bachs checkout transaction: ${error.message}`);
    if (!data || (reference && data.reference !== reference)) return null;
    return data as CheckoutTransaction;
  }

  if (reference) {
    const { data, error } = await supabase
      .from("payment_transactions")
      .select(columns)
      .eq("provider", "bachs")
      .eq("reference", reference)
      .maybeSingle();

    if (error) throw new Error(`Failed to find Bachs payment reference: ${error.message}`);
    if (data) return data as CheckoutTransaction;
  }

  return null;
}

async function getAppBaseUrl(): Promise<string> {
  const dbUrl = await getConfig("platform", "app_url");
  const configuredUrl =
    dbUrl ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    "https://agentify.app";

  return configuredUrl.trim().replace(/\/+$/, "");
}

export async function activateSubscriptionPlan(
  params: ActivatePlanParams
): Promise<ActivatePlanResult> {
  const eventTime = new Date(params.eventTimestamp);
  if (!Number.isFinite(eventTime.getTime())) {
    throw new Error("Bachs event has an invalid creation timestamp.");
  }

  if (params.currency !== "USD") {
    throw new Error("Bachs payment currency does not match the USD subscription.");
  }

  const transaction = await findCheckoutTransaction(params.checkoutId, params.reference);
  if (!transaction) {
    throw new Error("No Agentify checkout transaction matches the Bachs payment.");
  }

  if (!isPaidPlan(transaction.plan) || transaction.provider !== "bachs") {
    throw new Error("The matching transaction does not identify a supported Bachs plan.");
  }

  const expectedAmount = PLAN_CONFIG[transaction.plan].amount_decimal;
  if (expectedAmount === null || Number(params.amount) !== Number(expectedAmount)) {
    throw new Error("Bachs payment amount does not match the selected USD plan.");
  }

  const rawResponse = transaction.raw_response || {};
  const storedProductId =
    typeof rawResponse.product_id === "string" ? rawResponse.product_id : null;
  const configuredPlan = await getEffectivePlanConfig(transaction.plan);
  const configuredProductId =
    configuredPlan.bachs_product_id ||
    process.env[
      transaction.plan === "starter"
        ? "BACHS_STARTER_PRODUCT_ID"
        : "BACHS_GROWTH_PRODUCT_ID"
    ]?.trim() ||
    null;

  if (
    !storedProductId ||
    !configuredProductId ||
    storedProductId !== configuredProductId ||
    (params.productId && params.productId !== storedProductId)
  ) {
    throw new Error("Bachs product does not match the product recorded for this checkout.");
  }

  if (
    params.metadata?.plan !== undefined &&
    params.metadata.plan !== transaction.plan
  ) {
    throw new Error("Bachs checkout metadata does not match the recorded plan.");
  }

  const businessMetadataId =
    typeof params.metadata?.business_id === "string"
      ? params.metadata.business_id
      : null;
  if (businessMetadataId && businessMetadataId !== transaction.business_id) {
    throw new Error("Bachs checkout metadata does not match the recorded business.");
  }

  const supabase = createServiceClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, owner_id, name, contact_email")
    .eq("id", transaction.business_id)
    .maybeSingle();

  if (businessError) {
    throw new Error(`Failed to verify checkout business ownership: ${businessError.message}`);
  }
  if (!business) throw new Error("The business associated with this checkout no longer exists.");

  const recordedUserId =
    typeof rawResponse.user_id === "string" ? rawResponse.user_id : null;
  const metadataUserId =
    typeof params.metadata?.user_id === "string" ? params.metadata.user_id : null;
  if (
    !recordedUserId ||
    recordedUserId !== business.owner_id ||
    (metadataUserId && metadataUserId !== business.owner_id)
  ) {
    throw new Error("Bachs checkout identity does not match the business owner.");
  }

  const limits = await getEffectivePlanLimits(transaction.plan);
  const periodStart = params.periodStart || eventTime.toISOString();
  const periodEnd = params.periodEnd || (() => {
    const date = new Date(periodStart);
    date.setUTCMonth(date.getUTCMonth() + 1);
    return date.toISOString();
  })();

  const { data, error } = await supabase.rpc("apply_bachs_checkout_payment", {
    p_event_id: params.eventId,
    p_transaction_id: transaction.id,
    p_product_id: storedProductId,
    p_customer_id: params.customerId || null,
    p_subscription_id: params.subscriptionId || null,
    p_amount: Number(params.amount),
    p_currency: params.currency,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_event_created_at: eventTime.toISOString(),
    p_charge_id: params.chargeId || null,
    p_limits: limits,
  });

  if (error) {
    logErrorSync(error, "bachs-atomic-subscription-activation", {
      businessId: transaction.business_id,
      metadata: { eventId: params.eventId, sourceEvent: params.sourceEvent },
    });
    throw new Error(`Failed to apply verified Bachs payment: ${error.message}`);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Bachs payment update returned no subscription result.");
  }

  const result = data as {
    plan?: "starter" | "growth";
    subscription_id?: string | null;
    duplicate?: boolean;
  };
  const activePlan = result.plan || transaction.plan;

  try {
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/billing");
    revalidatePath("/");
  } catch (error) {
    logErrorSync(error, "bachs-subscription-cache-revalidation", {
      businessId: transaction.business_id,
    });
  }

  if (!result.duplicate && business.contact_email) {
    try {
      const appUrl = await getAppBaseUrl();
      await sendTransactionalEmail({
        businessId: transaction.business_id,
        to: business.contact_email,
        subject: `Your Agentify ${activePlan === "growth" ? "Growth" : "Starter"} subscription is active`,
        templateName: "payment-success-email",
        react: PaymentSuccessEmail({
          businessName: business.name || "there",
          plan: activePlan === "growth" ? "Growth" : "Starter",
          amount: `$${Number(params.amount).toFixed(2)} USD`,
          billingUrl: `${appUrl}/dashboard/billing`,
        }),
      });
    } catch (error) {
      logErrorSync(error, "bachs-subscription-confirmation-email", {
        businessId: transaction.business_id,
      });
    }
  }

  return {
    success: true,
    businessId: transaction.business_id,
    plan: activePlan,
    subscriptionId: result.subscription_id || null,
    duplicate: Boolean(result.duplicate),
  };
}
