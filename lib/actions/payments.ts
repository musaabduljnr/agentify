"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import {
  createBachsCheckoutSession,
  createBachsCustomerPortalSession,
  getBachsSubscription,
  getBachsCheckoutSession,
  BachsApiError,
} from "@/lib/payments/bachs";
import { type PlanId } from "@/lib/billing/plans";
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
    "https://agentify.app";

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
  try {
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
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("business_id", business.id)
      .maybeSingle();

    if (!subscription) {
      return { error: "No subscription record found. Please contact support." };
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

    const appBaseUrl = await getAppBaseUrl();
    // Bachs automatically appends ?checkout_id=chk_xxx to the success URL.
    // Do NOT use {CHECKOUT_SESSION_ID} - that is a Stripe-only convention and Bachs will NOT substitute it.
    const successUrl = `${appBaseUrl}/dashboard/billing?status=success`;
    const cancelUrl = `${appBaseUrl}/dashboard/billing?status=cancelled`;

    // 5. Generate durable reference and initialize Bachs checkout session
    const businessIdShort = business.id.substring(0, 8);
    const reference = `agentify_${businessIdShort}_${Date.now()}`;
    const customerId = (subscription as any).bachs_customer_id || subscription.provider_customer_id;

    const checkoutRes = await createBachsCheckoutSession({
      productId,
      customerEmail: user.email || business.contact_email || "billing@agentify.co",
      customerName: business.name || user.user_metadata?.name || undefined,
      customerId: customerId || undefined,
      businessId: business.id,
      userId: user.id,
      plan,
      reference,
      successUrl,
      cancelUrl,
    });

    // 6. Record pending transaction using service client
    const serviceClient = createServiceClient();
    const amountNumber = plan === "starter" ? 2 : 10;

    const { error: insertError } = await serviceClient
      .from("payment_transactions")
      .insert({
        business_id: business.id,
        subscription_id: subscription.id,
        provider: "bachs",
        reference,
        checkout_id: checkoutRes.checkoutId,
        plan,
        amount: amountNumber,
        currency: "USD",
        status: "pending",
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
      });

    if (insertError) {
      logErrorSync(insertError, "bachs-checkout", { businessId: business.id, userId: user.id });
      return { error: "Failed to record checkout session." };
    }

    return { checkoutUrl: checkoutRes.checkoutUrl };
  } catch (error: any) {
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

    const serviceClient = createServiceClient();
    const { data: transaction } = await serviceClient
      .from("payment_transactions")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (!transaction) {
      return { error: "Transaction not found." };
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
 * Verifies a Bachs checkout session directly via the Bachs API and synchronizes the subscription.
 * Serves as an immediate reconciliation check when the user returns to the dashboard,
 * ensuring verified payments upgrade the plan with 0ms user-visible delay even before
 * or concurrent with webhook delivery.
 */
export async function reconcileCheckoutSession(checkoutId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!checkoutId || checkoutId.includes("{CHECKOUT_SESSION_ID}")) {
      return { isSuccess: false, message: "Invalid session ID." };
    }

    const session = await getBachsCheckoutSession(checkoutId);
    if (!session) {
      return { isSuccess: false, message: "Session not found." };
    }

    const isPaid =
      session.payment_status === "paid" ||
      session.payment_status === "succeeded" ||
      session.status === "completed";

    if (!isPaid) {
      return {
        isSuccess: false,
        status: session.status,
        paymentStatus: session.payment_status,
      };
    }

    const metadata = (session.metadata as Record<string, any>) || {};
    const customerId =
      (session.customer as any)?.id ||
      (session.customer as any)?.customer_id ||
      (typeof session.customer === "string" ? session.customer : null);
    const subscriptionId =
      typeof (session as any).subscription === "string"
        ? (session as any).subscription
        : ((session as any).subscription?.id || null);
    const productId = (session as any).product_cart?.[0]?.product_id || null;
    const plan = metadata.plan || (productId === process.env.BACHS_GROWTH_PRODUCT_ID ? "growth" : "starter");

    const result = await activateSubscriptionPlan({
      businessId: metadata.business_id || null,
      userId: metadata.user_id || user.id,
      plan,
      productId,
      checkoutId,
      customerId,
      subscriptionId,
      amount: Number(session.amount) || (plan === "growth" ? 10.0 : 2.0),
      reference: (session.reference as string) || null,
      sourceEvent: "client_reconciliation",
    });

    return {
      isSuccess: result.success,
      plan: result.plan,
      status: "active",
    };
  } catch (error: any) {
    logErrorSync(error, "reconcile-checkout-session");
    return { error: error.message || "Failed to reconcile checkout session." };
  }
}

