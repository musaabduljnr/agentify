import "server-only";

import { createServiceClient } from "@/utils/supabase/service";
import { type PlanId, PLAN_ORDER } from "@/lib/billing/plans";
import { getEffectivePlanLimits, getEffectivePlanConfigs } from "@/lib/billing/platform";
import { logErrorSync } from "@/lib/monitoring/log-error";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { PaymentSuccessEmail } from "@/lib/email/templates/payment-success-email";
import { getConfig } from "@/lib/config/platform-config";
import { revalidatePath } from "next/cache";

async function getAppBaseUrl(): Promise<string> {
  const dbUrl = await getConfig("platform", "app_url");
  const configuredUrl =
    dbUrl ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "https://agentify.app";

  return configuredUrl.trim().replace(/\/+$/, "");
}

/**
 * Maps a Bachs Product ID to an Agentify PlanId ("starter" | "growth").
 */
export async function resolvePlanFromProductId(productId?: string | null): Promise<PlanId | null> {
  if (!productId) return null;
  const cleanId = productId.trim();

  // 1. Check environment variables
  if (process.env.BACHS_GROWTH_PRODUCT_ID && cleanId === process.env.BACHS_GROWTH_PRODUCT_ID.trim()) {
    return "growth";
  }
  if (process.env.BACHS_STARTER_PRODUCT_ID && cleanId === process.env.BACHS_STARTER_PRODUCT_ID.trim()) {
    return "starter";
  }

  // 2. Check effective plan configs (database overrides)
  try {
    const configs = await getEffectivePlanConfigs();
    if (configs.growth?.bachs_product_id === cleanId) return "growth";
    if (configs.starter?.bachs_product_id === cleanId) return "starter";
  } catch (err) {
    console.warn("[resolvePlanFromProductId] Could not check effective configs:", err);
  }

  return null;
}

export interface ActivatePlanParams {
  businessId?: string | null;
  userId?: string | null;
  plan?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  productId?: string | null;
  amount?: number | null;
  currency?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  checkoutId?: string | null;
  chargeId?: string | null;
  invoiceId?: string | null;
  reference?: string | null;
  eventTimestamp?: string | null;
  sourceEvent: string;
}

export interface ActivatePlanResult {
  success: boolean;
  businessId: string;
  plan: PlanId;
  subscriptionId: string;
  isUpgraded: boolean;
  error?: string;
}

/**
 * Authoritative, atomic, and idempotent subscription upgrade/activation engine.
 * Guarantees that confirmed payments upgrade the user's plan to Growth (or Starter),
 * applies correct quotas immediately, records payment transactions, and revalidates dashboard cache.
 */
export async function activateSubscriptionPlan(
  params: ActivatePlanParams
): Promise<ActivatePlanResult> {
  const serviceClient = createServiceClient();
  const eventTime = params.eventTimestamp || new Date().toISOString();

  // 1. Resolve Target Business ID
  let targetBusinessId = params.businessId || null;

  // Resolve via userId
  if (!targetBusinessId && params.userId) {
    const { data: bus } = await serviceClient
      .from("businesses")
      .select("id")
      .eq("owner_id", params.userId)
      .maybeSingle();
    targetBusinessId = bus?.id || null;
  }

  // Resolve via checkoutId in payment_transactions
  let matchedTransaction: any = null;
  if (params.checkoutId) {
    const { data: tx } = await serviceClient
      .from("payment_transactions")
      .select("*")
      .eq("checkout_id", params.checkoutId)
      .maybeSingle();
    if (tx) {
      matchedTransaction = tx;
      if (!targetBusinessId) targetBusinessId = tx.business_id;
    }
  }

  // Resolve via reference in payment_transactions
  if (!targetBusinessId && params.reference) {
    const { data: tx } = await serviceClient
      .from("payment_transactions")
      .select("*")
      .eq("reference", params.reference)
      .maybeSingle();
    if (tx) {
      matchedTransaction = tx;
      targetBusinessId = tx.business_id;
    }
  }

  // Resolve via customerId in subscriptions
  if (!targetBusinessId && params.customerId) {
    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("business_id")
      .or(`bachs_customer_id.eq.${params.customerId},provider_customer_id.eq.${params.customerId}`)
      .maybeSingle();
    if (sub) targetBusinessId = sub.business_id;
  }

  // Resolve via subscriptionId in subscriptions
  if (!targetBusinessId && params.subscriptionId) {
    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("business_id")
      .or(`bachs_subscription_id.eq.${params.subscriptionId},provider_subscription_id.eq.${params.subscriptionId}`)
      .maybeSingle();
    if (sub) targetBusinessId = sub.business_id;
  }

  if (!targetBusinessId) {
    const errMsg = `[activateSubscriptionPlan] Could not resolve business for checkout=${params.checkoutId}, customer=${params.customerId}, sub=${params.subscriptionId}`;
    logErrorSync(new Error(errMsg), "activate-plan-no-business", {
      businessId: params.businessId || undefined,
      metadata: params as unknown as Record<string, unknown>,
    });
    return {
      success: false,
      businessId: "",
      plan: "starter",
      subscriptionId: "",
      isUpgraded: false,
      error: errMsg,
    };
  }

  // 2. Resolve Target Plan
  let targetPlan: PlanId = "starter";

  if (params.plan && (params.plan === "starter" || params.plan === "growth" || params.plan === "enterprise")) {
    targetPlan = params.plan as PlanId;
  } else if (params.productId) {
    const mappedPlan = await resolvePlanFromProductId(params.productId);
    if (mappedPlan) targetPlan = mappedPlan;
  }

  // Fallback to plan from matched pending transaction
  if (targetPlan === "starter" && matchedTransaction?.plan) {
    targetPlan = matchedTransaction.plan as PlanId;
  }

  // Fallback based on amount ($10 => growth, $2 => starter)
  // Bachs may send amount in minor units (cents): 1000 = $10, 200 = $2
  if (targetPlan === "starter" && params.amount) {
    const normalizedAmount = params.amount > 100 ? params.amount / 100 : params.amount;
    if (normalizedAmount >= 9.0) {
      targetPlan = "growth";
    }
  }

  // 3. Fetch current subscription to check out-of-order events
  const { data: currentSub } = await serviceClient
    .from("subscriptions")
    .select("*")
    .eq("business_id", targetBusinessId)
    .maybeSingle();

  const previousPlan = currentSub?.plan || null;

  if (currentSub) {
    // If incoming event is an older event (older than currentSub.updated_at by > 30s)
    // and current plan is already higher than or equal to incoming plan, do not regress.
    const currentPlanIndex = PLAN_ORDER.indexOf(currentSub.plan as PlanId);
    const targetPlanIndex = PLAN_ORDER.indexOf(targetPlan);

    // Guard: Never let an incoming payment/webhook event downgrade a higher active plan (e.g. Growth -> Starter).
    // Downgrades only happen via explicit cancellation or scheduled downgrade at period end.
    const isExplicitDowngradeEvent =
      params.sourceEvent === "customer.subscription.deleted" ||
      params.sourceEvent === "subscription.canceled" ||
      params.sourceEvent === "admin_downgrade";

    if (currentPlanIndex > targetPlanIndex && !isExplicitDowngradeEvent && currentSub.status === "active") {
      console.log(
        `[activateSubscriptionPlan] Retaining active higher plan '${currentSub.plan}' over incoming '${targetPlan}' for business ${targetBusinessId}`
      );
      targetPlan = currentSub.plan as PlanId;
    } else if (
      currentSub.updated_at &&
      Date.parse(currentSub.updated_at) > Date.parse(eventTime) + 30000 &&
      currentPlanIndex >= targetPlanIndex
    ) {
      console.log(
        `[activateSubscriptionPlan] Ignoring out-of-order event for ${targetBusinessId}. Current plan ${currentSub.plan} is newer than ${targetPlan}`
      );
      return {
        success: true,
        businessId: targetBusinessId,
        plan: currentSub.plan as PlanId,
        subscriptionId: currentSub.id,
        isUpgraded: false,
      };
    }
  }

  // 4. Resolve limits for target plan
  const planLimits = await getEffectivePlanLimits(targetPlan);

  // Calculate billing period dates
  const periodStart = params.periodStart || new Date().toISOString();
  let periodEnd = params.periodEnd;
  if (!periodEnd) {
    const d = new Date(periodStart);
    d.setMonth(d.getMonth() + 1);
    periodEnd = d.toISOString();
  }

  const finalAmount =
    params.amount !== undefined && params.amount !== null
      ? params.amount
      : targetPlan === "growth"
      ? 10.0
      : 2.0;

  // 5. Update or Create subscription record atomically
  const subUpdatePayload: Record<string, any> = {
    plan: targetPlan,
    status: "active",
    payment_provider: "bachs",
    provider: "bachs",
    billing_currency: "USD",
    billing_amount: finalAmount,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    reset_date: periodEnd,
    canceled_at: null,
    cancel_at_period_end: false,
    ...planLimits,
    updated_at: eventTime,
  };

  if (params.customerId) {
    subUpdatePayload.bachs_customer_id = params.customerId;
    subUpdatePayload.provider_customer_id = params.customerId;
  }
  if (params.subscriptionId) {
    subUpdatePayload.bachs_subscription_id = params.subscriptionId;
    subUpdatePayload.provider_subscription_id = params.subscriptionId;
  }
  if (params.productId) {
    subUpdatePayload.bachs_product_id = params.productId;
  }

  let finalSubscriptionId = currentSub?.id;

  if (currentSub) {
    const { error: updateSubErr } = await serviceClient
      .from("subscriptions")
      .update(subUpdatePayload)
      .eq("id", currentSub.id);

    if (updateSubErr) {
      logErrorSync(updateSubErr, "activate-plan-update-sub-failed", {
        businessId: targetBusinessId,
        metadata: subUpdatePayload,
      });
      throw new Error(`Failed to update subscription: ${updateSubErr.message}`);
    }
  } else {
    // Insert new subscription record
    const { data: newSub, error: insertSubErr } = await serviceClient
      .from("subscriptions")
      .insert({
        business_id: targetBusinessId,
        current_usage: 0,
        ...subUpdatePayload,
      })
      .select("id")
      .single();

    if (insertSubErr) {
      logErrorSync(insertSubErr, "activate-plan-insert-sub-failed", {
        businessId: targetBusinessId,
        metadata: subUpdatePayload,
      });
      throw new Error(`Failed to insert subscription: ${insertSubErr.message}`);
    }
    finalSubscriptionId = newSub.id;
  }

  // 6. Update or record successful payment transaction (non-fatal if table update fails)
  try {
    const txRef = params.reference || matchedTransaction?.reference || `tx_${targetBusinessId.substring(0, 8)}_${Date.now()}`;
    const checkoutId = params.checkoutId || matchedTransaction?.checkout_id || null;

    if (matchedTransaction) {
      await serviceClient
        .from("payment_transactions")
        .update({
          status: "success",
          plan: targetPlan,
          amount: finalAmount,
          currency: "USD",
          charge_id: params.chargeId || matchedTransaction.charge_id || null,
          invoice_id: params.invoiceId || matchedTransaction.invoice_id || null,
          provider_customer_id: params.customerId || matchedTransaction.provider_customer_id || null,
          provider_subscription_id: params.subscriptionId || matchedTransaction.provider_subscription_id || null,
          verified_at: eventTime,
        })
        .eq("id", matchedTransaction.id);
    } else if (checkoutId) {
      await serviceClient
        .from("payment_transactions")
        .update({
          status: "success",
          plan: targetPlan,
          amount: finalAmount,
          currency: "USD",
          charge_id: params.chargeId || null,
          invoice_id: params.invoiceId || null,
          provider_customer_id: params.customerId || null,
          provider_subscription_id: params.subscriptionId || null,
          verified_at: eventTime,
        })
        .eq("checkout_id", checkoutId);
    } else {
      // Insert standalone transaction record (e.g. from subscription invoice)
      await serviceClient
        .from("payment_transactions")
        .insert({
          business_id: targetBusinessId,
          subscription_id: finalSubscriptionId,
          provider: "bachs",
          reference: txRef,
          checkout_id: checkoutId,
          charge_id: params.chargeId || null,
          invoice_id: params.invoiceId || null,
          provider_customer_id: params.customerId || null,
          provider_subscription_id: params.subscriptionId || null,
          plan: targetPlan,
          amount: finalAmount,
          currency: "USD",
          status: "success",
          verified_at: eventTime,
        });
    }
  } catch (txErr) {
    console.warn("[activateSubscriptionPlan] Non-fatal: payment_transactions sync warning:", txErr);
  }

  // 7. Revalidate Next.js cache so dashboard immediately reflects Growth plan
  try {
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/billing");
    revalidatePath("/");
  } catch (revalErr) {
    console.warn("[activateSubscriptionPlan] Path revalidation error:", revalErr);
  }

  // 8. Send transactional confirmation email
  try {
    const { data: business } = await serviceClient
      .from("businesses")
      .select("name, contact_email")
      .eq("id", targetBusinessId)
      .maybeSingle();

    if (business?.contact_email) {
      const appUrl = await getAppBaseUrl();
      await sendTransactionalEmail({
        businessId: targetBusinessId,
        to: business.contact_email,
        subject: `Your Agentify ${targetPlan === "growth" ? "Growth" : "Starter"} subscription is active`,
        templateName: "payment-success-email",
        react: PaymentSuccessEmail({
          businessName: business.name || "there",
          plan: targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1),
          amount: `$${Number(finalAmount).toFixed(2)} USD`,
          billingUrl: `${appUrl}/dashboard/billing`,
        }),
      });
    }
  } catch (emailErr) {
    console.error("[activateSubscriptionPlan] Failed to send confirmation email:", emailErr);
  }

  console.log(
    `[activateSubscriptionPlan] Successfully activated ${targetPlan} for business ${targetBusinessId} (source: ${params.sourceEvent})`
  );

  return {
    success: true,
    businessId: targetBusinessId,
    plan: targetPlan,
    subscriptionId: finalSubscriptionId || "",
    isUpgraded: previousPlan !== targetPlan,
  };
}
