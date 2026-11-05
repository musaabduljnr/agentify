"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import {
  createBachsCheckoutSession,
  createBachsCustomerPortalSession,
  getBachsCheckoutSession,
  BachsApiError,
} from "@/lib/payments/bachs";
import { PLAN_CONFIG } from "@/lib/billing/plans";
import {
  getEffectivePlanConfig,
} from "@/lib/billing/platform";
import { activateSubscriptionPlan } from "@/lib/billing/upgrade";
import { revalidatePath } from "next/cache";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";
import { getConfig } from "@/lib/config/platform-config";

async function getAppBaseUrl(): Promise<string> {
  const dbUrl = await getConfig("platform", "app_url");
  const configuredUrl =
    dbUrl ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://agentifychat.online";

  const trimmedUrl = configuredUrl.trim().replace(/\/+$/, "");
  if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
}

/**
 * Creates a hosted checkout session using Bachs (USD Only).
 * Fully server-side validated: resolves trusted product IDs, enforces USD currency,
 * and sets user/business metadata.
 */
export async function createCheckoutSession(
  plan: "starter" | "growth"
) {
  let transactionId: string | null = null;

  try {
    if (plan !== "starter" && plan !== "growth") {
      return { error: "Only Starter and Growth subscriptions are available for checkout." };
    }

    // 0. Check feature flag
    const paymentsEnabled = await getConfig("feature_flags", "enable_payments");
    if (paymentsEnabled === "false") {
      return { error: "Payments are temporarily disabled. Please try again later." };
    }

    // 1. Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Unauthorized. Please log in to continue." };
    }

    // 2. Get current business
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      return { error: "No business found. Please complete onboarding first." };
    }

    // 3. Get current subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("business_id", business.id)
      .maybeSingle();

    if (subscriptionError) {
      throw new Error(`Failed to load the current subscription: ${subscriptionError.message}`);
    }
    if (!subscription) {
      return { error: "No subscription record found. Please contact support." };
    }

    const serviceClient = createServiceClient();
    const { data: existingPendingTransaction, error: pendingTransactionError } =
      await serviceClient
        .from("payment_transactions")
        .select("id, plan, checkout_id, checkout_url, status")
        .eq("business_id", business.id)
        .eq("provider", "bachs")
        .eq("status", "pending")
        .not("checkout_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (pendingTransactionError) {
      throw new Error(`Failed to load pending checkout: ${pendingTransactionError.message}`);
    }

    if (existingPendingTransaction?.checkout_id) {
      if (existingPendingTransaction.plan !== plan) {
        return {
          error: "A checkout for another plan is already open. Complete or allow it to expire before starting a new checkout.",
        };
      }

      const currentSession = await getBachsCheckoutSession(existingPendingTransaction.checkout_id);
      if (currentSession.status === "open" && existingPendingTransaction.checkout_url) {
        return { checkoutUrl: existingPendingTransaction.checkout_url };
      }

      if (currentSession.payment_status === "paid") {
        return { error: "Your payment is processing. Refresh billing in a moment; do not pay again." };
      }

      const { error: expireError } = await serviceClient
        .from("payment_transactions")
        .update({
          status: "abandoned",
          failure_reason: "The previous checkout is no longer open.",
        })
        .eq("id", existingPendingTransaction.id)
        .eq("status", "pending");

      if (expireError) {
        throw new Error(`Failed to close the previous checkout: ${expireError.message}`);
      }
    }

    const currentPlanOrder = { starter: 0, growth: 1 } as const;
    if (
      subscription.status === "active" &&
      currentPlanOrder[plan] <=
        (subscription.plan === "growth" ? currentPlanOrder.growth : currentPlanOrder.starter)
    ) {
      return {
        error: "Your current plan already includes this subscription level. Use billing management to change your plan.",
      };
    }

    // 4. Resolve trusted plan config and product ID
    const planConfig = await getEffectivePlanConfig(plan);
    if (!planConfig) {
      return { error: "Invalid plan selected." };
    }

    const productId =
      planConfig.bachs_product_id ||
      (plan === "starter"
        ? process.env.BACHS_STARTER_PRODUCT_ID
        : process.env.BACHS_GROWTH_PRODUCT_ID);

    if (!productId || productId.includes("placeholder")) {
      return {
        error: `Bachs Product ID is not configured for the ${planConfig.name} plan. Please contact support.`,
      };
    }

    const expectedAmount = PLAN_CONFIG[plan].amount_decimal;
    if (
      !expectedAmount ||
      Number(planConfig.price_usd) !== Number(expectedAmount) ||
      planConfig.amount_decimal !== expectedAmount
    ) {
      throw new Error(`The configured ${plan} price does not match the fixed USD subscription price.`);
    }

    const appBaseUrl = await getAppBaseUrl();
    // Bachs automatically appends ?checkout_id=chk_xxx to the success URL.
    // Providing a clean base URL ensures standard `?checkout_id=...` parameter format.
    const successUrl = `${appBaseUrl}/dashboard/billing`;
    const cancelUrl = `${appBaseUrl}/dashboard/billing?status=cancelled`;

    // 5. Generate durable reference and initialize Bachs checkout session
    const reference = `agentify_${randomUUID().replace(/-/g, "")}`;
    const customerId = (subscription as any).bachs_customer_id || subscription.provider_customer_id;
    const amount = Number(expectedAmount);

    const { data: transaction, error: transactionError } = await serviceClient
      .from("payment_transactions")
      .insert({
        business_id: business.id,
        subscription_id: subscription.id,
        provider: "bachs",
        reference,
        plan,
        amount,
        billing_amount: amount,
        currency: "USD",
        status: "pending",
        raw_response: {
          reference,
          user_id: user.id,
          business_id: business.id,
          plan,
          product_id: productId,
        },
      })
      .select("id")
      .single();

    if (transactionError || !transaction) {
      throw new Error(
        `Failed to persist the pending checkout before contacting Bachs: ${transactionError?.message || "No transaction row returned."}`
      );
    }
    transactionId = transaction.id;

    const checkoutRes = await createBachsCheckoutSession({
      productId,
      customerEmail: user.email || business.contact_email || "billing@agentifychat.online",
      customerName: business.name || user.user_metadata?.name || undefined,
      customerId: customerId || undefined,
      businessId: business.id,
      userId: user.id,
      plan,
      reference,
      successUrl,
      cancelUrl,
    });

    const { error: updateError } = await serviceClient
      .from("payment_transactions")
      .update({
        checkout_id: checkoutRes.checkoutId,
        checkout_url: checkoutRes.checkoutUrl,
        raw_response: {
          checkout_id: checkoutRes.checkoutId,
          status: checkoutRes.status,
          product_id: productId,
          reference,
          user_id: user.id,
          business_id: business.id,
          plan,
        },
      })
      .eq("id", transaction.id);

    if (updateError) {
      logErrorSync(updateError, "bachs-checkout-record-update", {
        businessId: business.id,
        userId: user.id,
      });
      throw new Error("Bachs created the checkout, but Agentify could not save its checkout ID.");
    }

    return { checkoutUrl: checkoutRes.checkoutUrl };
  } catch (error: any) {
    if (transactionId) {
      const { error: statusError } = await createServiceClient()
        .from("payment_transactions")
        .update({
          status: "failed",
          failure_reason: error instanceof Error ? error.message : "Checkout initialization failed.",
        })
        .eq("id", transactionId)
        .eq("status", "pending");

      if (statusError) {
        logErrorSync(statusError, "bachs-checkout-failure-record", { metadata: { transactionId } });
      }
    }
    logErrorSync(error, "bachs-checkout");
    if (error instanceof BachsApiError) {
      return { error: `Checkout initialization failed: ${error.message} (${error.errorCode})` };
    }
    return { error: error.message || getUserFriendlyError("payment-checkout") };
  }
}

/**
 * Creates an authenticated Bachs Customer Portal session for managing subscriptions,
 * updating payment methods, viewing invoices, or cancellations.
 */
export async function createPortalSession() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      return { error: "Business not found." };
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("bachs_customer_id, provider_customer_id")
      .eq("business_id", business.id)
      .maybeSingle();

    const customerId = (subscription as any)?.bachs_customer_id || (subscription as any)?.provider_customer_id;
    if (!customerId) {
      return { error: "No active billing customer found. Please subscribe to a plan first." };
    }

    const session = await createBachsCustomerPortalSession(customerId);
    return { url: session.url };
  } catch (error: any) {
    logErrorSync(error, "bachs-portal-session");
    if (error instanceof BachsApiError) {
      return { error: `Could not open customer portal: ${error.message}` };
    }
    return { error: "Could not open billing portal. Please contact support." };
  }
}

/**
 * Reconciles payment status for the user dashboard.
 * Note: Subscriptions are authoritatively updated by Bachs webhooks.
 */
export async function verifyPaymentReference(reference: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError) throw businessError;
    if (!business) return { error: "Business not found." };

    const serviceClient = createServiceClient();
    const { data: transaction, error } = await serviceClient
      .from("payment_transactions")
      .select("status, plan")
      .eq("business_id", business.id)
      .eq("reference", reference)
      .maybeSingle();

    if (error) throw error;
    if (!transaction) {
      return { error: "Transaction not found or not owned by this account." };
    }

    return {
      status: transaction.status,
      plan: transaction.plan,
      isPending: transaction.status === "pending",
      isSuccess: transaction.status === "success",
      success: transaction.status === "success",
    };
  } catch (error: any) {
    logErrorSync(error, "payment-reference-check");
    return { error: "Could not check payment status." };
  }
}

/**
 * Loads payment history for the active business dashboard.
 */
export async function getPaymentHistory() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) return [];

    const { data, error } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    logErrorSync(error, "payment-history");
    return [];
  }
}

/**
 * Reconciles only a checkout created for the authenticated business. A paid state
 * returned by Bachs is provider evidence; URL parameters alone never grant access.
 */
export async function reconcileCheckoutSession(checkoutId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!checkoutId || checkoutId.includes("{CHECKOUT_SESSION_ID}")) {
      return { isSuccess: false, message: "Invalid session ID." };
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError) throw businessError;
    if (!business) return { error: "Business not found." };

    const serviceClient = createServiceClient();
    const { data: transaction, error: transactionError } = await serviceClient
      .from("payment_transactions")
      .select("id, plan, status")
      .eq("provider", "bachs")
      .eq("business_id", business.id)
      .eq("checkout_id", checkoutId)
      .maybeSingle();

    if (transactionError) throw transactionError;
    if (!transaction) {
      return { error: "This checkout does not belong to your business." };
    }

    const session = await getBachsCheckoutSession(checkoutId);
    if (!session) {
      return { isSuccess: false, message: "Session not found." };
    }

    if (session.status === "expired") {
      const { error } = await serviceClient
        .from("payment_transactions")
        .update({
          status: "abandoned",
          failure_reason: "Checkout expired. A late successful collection may still complete.",
        })
        .eq("id", transaction.id)
        .eq("status", "pending");
      if (error) throw error;

      return {
        isSuccess: false,
        status: session.status,
        paymentStatus: session.payment_status,
      };
    }

    if (session.status !== "completed" || session.payment_status !== "paid") {
      return {
        isSuccess: false,
        isPending: true,
        status: session.status,
        paymentStatus: session.payment_status,
        message: "Payment is still being confirmed. You do not need to start another checkout.",
      };
    }

    const metadata =
      session.metadata && typeof session.metadata === "object"
        ? (session.metadata as Record<string, unknown>)
        : {};
    const customer =
      session.customer && typeof session.customer === "object"
        ? (session.customer as Record<string, unknown>)
        : {};
    const subscription =
      session.subscription && typeof session.subscription === "object"
        ? (session.subscription as Record<string, unknown>)
        : {};
    const productCart = Array.isArray(session.product_cart) ? session.product_cart : [];
    const firstProduct =
      productCart[0] && typeof productCart[0] === "object"
        ? (productCart[0] as Record<string, unknown>)
        : {};
    const completedAt =
      typeof session.completed_at === "string"
        ? session.completed_at
        : new Date().toISOString();

    const result = await activateSubscriptionPlan({
      eventId: null,
      eventTimestamp: completedAt,
      checkoutId,
      reference: typeof session.reference === "string" ? session.reference : null,
      productId:
        typeof firstProduct.product_id === "string"
          ? firstProduct.product_id
          : typeof metadata.product_id === "string"
            ? metadata.product_id
            : null,
      customerId:
        typeof customer.customer_id === "string"
          ? customer.customer_id
          : typeof customer.id === "string"
            ? customer.id
            : null,
      subscriptionId:
        typeof subscription.subscription_id === "string"
          ? subscription.subscription_id
          : typeof subscription.id === "string"
            ? subscription.id
            : null,
      chargeId:
        session.charge && typeof session.charge === "object" &&
        typeof (session.charge as Record<string, unknown>).id === "string"
          ? (session.charge as Record<string, string>).id
          : null,
      amount: typeof session.amount === "string" ? session.amount : "",
      currency: typeof session.currency === "string" ? session.currency : "",
      metadata,
      sourceEvent: "checkout_reconciliation",
    });

    return {
      isSuccess: true,
      plan: result.plan,
      status: "active",
    };
  } catch (error: any) {
    logErrorSync(error, "reconcile-checkout-session");
    return { error: error.message || "Failed to reconcile checkout session." };
  }
}
