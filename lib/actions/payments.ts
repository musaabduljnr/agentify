"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import {
  initializePaystackTransaction,
  PaystackProviderError,
  verifyPaystackTransaction,
} from "@/lib/payments/paystack";
import { type PlanId } from "@/lib/billing/plans";
import {
  getBillingPlatformSettings,
  getEffectivePlanConfig,
  getEffectivePlanLimits,
} from "@/lib/billing/platform";
import { revalidatePath } from "next/cache";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { PaymentSuccessEmail } from "@/lib/email/templates/payment-success-email";
import { PaymentFailedEmail } from "@/lib/email/templates/payment-failed-email";

function getAppBaseUrl(): string {
  const configuredUrl =
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
 * Creates a checkout session using Paystack (primary) or Flutterwave (secondary).
 * Safe, server-side validated, and generates unique transaction references.
 */
export async function createCheckoutSession(
  plan: "starter" | "growth",
  provider: "paystack" | "flutterwave" = "paystack"
) {
  try {
    // 1. Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Unauthorized" };
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
      return { error: "No subscription found. Please contact support." };
    }

    // 4. Get plan config
    const [planConfig, billingSettings] = await Promise.all([
      getEffectivePlanConfig(plan),
      getBillingPlatformSettings(),
    ]);
    if (!planConfig) {
      return { error: "Invalid plan selected." };
    }

    // 5. Validate plan is paid
    if (planConfig.price_ngn === null || planConfig.price_ngn === 0) {
      return { error: "Selected plan cannot be subscribed to directly." };
    }

    // 6. Create unique reference: agentify_{businessIdShort}_{timestamp}
    const businessIdShort = business.id.substring(0, 8);
    const reference = `agentify_${businessIdShort}_${Date.now()}`;

    // 7. Call payment provider to initialize transaction
    let checkoutUrl = "";
    let rawResponse = {};

    if (provider === "paystack") {
      const planCode = planConfig.paystack_plan_code;
      if (!planCode) {
        logErrorSync(
          new Error(`No paystack_plan_code configured for plan "${plan}". Falling back to one-time transaction checkout.`),
          "payment-checkout",
          { businessId: business.id, userId: user.id }
        );
      }

      const callbackUrl = `${getAppBaseUrl()}/payment/callback`;

      const paystackRes = await initializePaystackTransaction({
        email: user.email || business.contact_email || "billing@agentify.com",
        amount: planConfig.price_ngn,
        currency: billingSettings.currency,
        planCode: planCode || undefined, // One-time fallback if missing
        reference,
        businessId: business.id,
        callbackUrl,
        metadata: {
          plan,
          userId: user.id,
        },
      });

      checkoutUrl = paystackRes.authorizationUrl;
      rawResponse = paystackRes;
    } else if (provider === "flutterwave") {
      // Flutterwave is secondary and throws error if keys are missing
      const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY;
      if (!flwSecret || flwSecret.includes("placeholder")) {
        return { error: "Flutterwave payment is not enabled yet." };
      }
      return { error: "Flutterwave checkout is not fully implemented yet." };
    } else {
      return { error: "Unsupported payment provider selected." };
    }

    // 8. Save pending transaction in payment_transactions table using service role
    const serviceClient = createServiceClient();
    const { error: insertError } = await serviceClient
      .from("payment_transactions")
      .insert({
        business_id: business.id,
        subscription_id: subscription.id,
        provider,
        reference,
        plan,
        amount: planConfig.price_ngn,
        currency: billingSettings.currency,
        status: "pending",
        checkout_url: checkoutUrl,
        raw_response: rawResponse,
      });

    if (insertError) {
      logErrorSync(insertError, "payment-checkout", { businessId: business.id, userId: user.id });
      return { error: "Failed to record payment transaction record." };
    }

    // 9. Return checkout URL
    return { checkoutUrl };
  } catch (error: any) {
    logErrorSync(error, "payment-checkout");
    if (error instanceof PaystackProviderError) {
      return { error: `Paystack checkout failed: ${error.message}` };
    }
    return { error: getUserFriendlyError("payment-checkout") };
  }
}

/**
 * Verifies transaction reference on redirect callback.
 * Safely updates database transaction logs and upgrades the business's subscription plans.
 */
export async function verifyPaymentReference(reference: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Fetch transaction details using service role client
    const serviceClient = createServiceClient();
    const { data: transaction, error: fetchTxError } = await serviceClient
      .from("payment_transactions")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (fetchTxError || !transaction) {
      return { error: "Transaction not found." };
    }

    // Verify ownership of the business
    const { data: business } = await serviceClient
      .from("businesses")
      .select("name, owner_id, contact_email")
      .eq("id", transaction.business_id)
      .single();

    if (!business || business.owner_id !== user.id) {
      return { error: "Unauthorized to verify this transaction." };
    }

    // If transaction is already handled, return immediate result
    if (transaction.status === "success") {
      return { success: true, plan: transaction.plan };
    }
    if (transaction.status !== "pending") {
      return { error: `Transaction has already been finalized as '${transaction.status}'.` };
    }

    let paymentVerified = false;
    let customerCode = "";
    let subscriptionCode = "";
    let planCode = "";
    let rawPaystackResponse = {};

    if (transaction.provider === "paystack") {
      const paystackData = await verifyPaystackTransaction(reference);
      rawPaystackResponse = paystackData;

      if (paystackData.status === "success") {
        paymentVerified = true;
        customerCode = paystackData.customer?.customer_code || "";
        subscriptionCode = paystackData.subscription || "";
        planCode = paystackData.plan || "";
      }
    } else {
      return { error: "Unsupported payment provider." };
    }

    if (paymentVerified) {
      const planLimits = await getEffectivePlanLimits(transaction.plan as PlanId);
      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);

      // 1. Mark transaction success
      await serviceClient
        .from("payment_transactions")
        .update({
          status: "success",
          verified_at: now.toISOString(),
          raw_response: {
            ...((transaction.raw_response as Record<string, any>) || {}),
            verification: rawPaystackResponse,
          },
        })
        .eq("id", transaction.id);

      // 2. Upgrade subscription
      const { error: subError } = await serviceClient
        .from("subscriptions")
        .update({
          plan: transaction.plan,
          status: "active",
          payment_provider: transaction.provider,
          provider_customer_id: customerCode || null,
          provider_subscription_id: subscriptionCode || null,
          provider_plan_code: planCode || null,
          provider_reference: reference,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          reset_date: periodEnd.toISOString(),
          cancel_at_period_end: false,
          ...planLimits,
          updated_at: now.toISOString(),
        })
        .eq("business_id", transaction.business_id);

      if (subError) throw subError;

      await sendTransactionalEmail({
        businessId: transaction.business_id,
        to: user.email || business.contact_email,
        subject: "Payment successful — your Agentify plan is active",
        templateName: "payment-success-email",
        react: PaymentSuccessEmail({
          businessName: business?.name || "there",
          plan: String(transaction.plan),
          amount: transaction.amount ? `${transaction.currency} ${Number(transaction.amount).toLocaleString()}` : null,
          billingUrl: `${getAppBaseUrl()}/dashboard/billing`,
        }),
      });

      revalidatePath("/dashboard/billing");
      return { success: true, plan: transaction.plan };
    } else {
      // Finalize transaction failure
      await serviceClient
        .from("payment_transactions")
        .update({
          status: "failed",
          raw_response: {
            ...((transaction.raw_response as Record<string, any>) || {}),
            verification: rawPaystackResponse,
          },
        })
        .eq("id", transaction.id);

      await sendTransactionalEmail({
        businessId: transaction.business_id,
        to: user.email || business.contact_email,
        subject: "Payment failed — action needed",
        templateName: "payment-failed-email",
        react: PaymentFailedEmail({
          businessName: business?.name || "there",
          plan: String(transaction.plan),
          billingUrl: `${getAppBaseUrl()}/dashboard/billing`,
        }),
      });

      return { error: "Payment verification failed." };
    }
  } catch (error: any) {
    logErrorSync(error, "payment-verification");
    if (error instanceof PaystackProviderError) {
      return { error: `Paystack verification failed: ${error.message}` };
    }
    return { error: "Payment verification failed. Please contact support if you were charged." };
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
