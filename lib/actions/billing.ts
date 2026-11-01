"use server";

// ══════════════════════════════════════════════════════════════
// Billing Server Actions (for dashboard)
// ══════════════════════════════════════════════════════════════

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { getBusinessSubscription, getCurrentPlan, getRemainingUsage } from "@/lib/billing/subscription";
import { getUsageSummary } from "@/lib/billing/usage";
import { PLAN_ORDER } from "@/lib/billing/plans";
import {
  formatCurrencyAmount,
  getBillingPlatformSettings,
  getEffectivePlanConfigs,
} from "@/lib/billing/platform";
import { activateSubscriptionPlan } from "@/lib/billing/upgrade";
import { revalidatePath } from "next/cache";

async function getCurrentBusiness() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, contact_email, phone, address, website_url")
    .eq("owner_id", user.id)
    .single();

  return business;
}

/**
 * Get full billing data for the dashboard billing page.
 */
export async function getBillingData() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return null;

    const supabase = await createClient();
    const [initialPlanData, usage, billingSettings, effectivePlans, assistantsRes] = await Promise.all([
      getCurrentPlan(business.id),
      getUsageSummary(business.id),
      getBillingPlatformSettings(),
      getEffectivePlanConfigs(),
      supabase.from("assistants").select("id", { count: "exact", head: true }).eq("business_id", business.id),
    ]);

    let planData = initialPlanData;

    // Self-healing: If the subscription is still on Starter, check if a successful
    // Growth transaction exists in payment_transactions. If so, immediately activate Growth.
    if (planData && planData.planId === "starter") {
      const serviceClient = createServiceClient();
      const { data: growthTx } = await serviceClient
        .from("payment_transactions")
        .select("*")
        .eq("business_id", business.id)
        .eq("status", "success")
        .eq("plan", "growth")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (growthTx) {
        console.log(`[getBillingData] Self-healing activated: business ${business.id} has verified Growth transaction (${growthTx.checkout_id || growthTx.id}). Upgrading...`);
        const healResult = await activateSubscriptionPlan({
          businessId: business.id,
          plan: "growth",
          checkoutId: growthTx.checkout_id,
          amount: Number(growthTx.amount) || 10,
          reference: growthTx.reference,
          sourceEvent: "self_healing_billing_load",
        });

        if (healResult.success) {
          planData = await getCurrentPlan(business.id);
        }
      }
    }

    if (!planData) return null;

    const { subscription, plan, planId } = planData;
    const assistantCount = assistantsRes.count ?? 1;
    const widgetLimit = plan.widgets ?? 999999999;

    // Build plan comparison for all plans
    const plans = PLAN_ORDER.map((id) => {
      const config = effectivePlans[id];
      return {
        id,
        name: config.name,
        price: formatCurrencyAmount(config.price_usd, billingSettings),
        price_usd: config.price_usd,
        features: config.features,
        isCurrent: id === planId,
        isUpgrade: PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(planId),
        isDowngrade: PLAN_ORDER.indexOf(id) < PLAN_ORDER.indexOf(planId),
      };
    });

    const planCost = plan.price_usd !== null && plan.price_usd !== undefined
      ? `$${plan.price_usd}`
      : "Custom";

    return {
      business,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        payment_provider: subscription.payment_provider || "bachs",
        bachs_customer_id: (subscription as any).bachs_customer_id || subscription.provider_customer_id,
        bachs_subscription_id: (subscription as any).bachs_subscription_id || subscription.provider_subscription_id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        reset_date: subscription.reset_date,
        cancel_at_period_end: subscription.cancel_at_period_end,
        metadata: subscription.metadata || {},
      },
      currentPlan: {
        id: planId,
        name: plan.name,
        price: planCost,
        price_usd: plan.price_usd,
      },
      billingSettings,
      usage: {
        ...usage,
        widgets: {
          used: assistantCount,
          limit: widgetLimit,
          remaining: Math.max(0, widgetLimit - assistantCount),
          allowed: assistantCount < widgetLimit,
        },
      },
      plans,
    };
  } catch (err: any) {
    console.error("getBillingData error:", err);
    return null;
  }
}

/**
 * Get usage warning level for a business.
 * Returns warning data if usage is at 70%, 90%, or 100%+.
 */
export async function getUsageWarnings() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return [];

    const usage = await getUsageSummary(business.id);
    const warnings: {
      type: string;
      label: string;
      level: "warning" | "critical" | "blocked";
      used: number;
      limit: number;
      percentage: number;
    }[] = [];

    const checkResource = (
      type: string,
      label: string,
      data: { used: number; limit: number }
    ) => {
      if (data.limit >= 999999999) return; // unlimited
      const pct = Math.round((data.used / data.limit) * 100);
      if (pct >= 100) {
        warnings.push({ type, label, level: "blocked", used: data.used, limit: data.limit, percentage: pct });
      } else if (pct >= 90) {
        warnings.push({ type, label, level: "critical", used: data.used, limit: data.limit, percentage: pct });
      } else if (pct >= 70) {
        warnings.push({ type, label, level: "warning", used: data.used, limit: data.limit, percentage: pct });
      }
    };

    checkResource("messages", "AI Messages", usage.messages);
    checkResource("embeddings", "Embeddings", usage.embeddings);
    checkResource("leads", "Leads", usage.leads);
    checkResource("knowledge_sources", "Knowledge Sources", usage.knowledge_sources);

    return warnings;
  } catch (err: any) {
    console.error("getUsageWarnings error:", err);
    return [];
  }
}

/**
 * Mark the current subscription to cancel at the end of the billing period.
 * The subscription remains active until the period ends.
 */
export async function cancelSubscriptionAtPeriodEnd() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const business = await getCurrentBusiness();
    if (!business) return { error: "No business found." };

    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return { success: true };
  } catch (err: any) {
    console.error("cancelSubscriptionAtPeriodEnd error:", err);
    return { error: "Failed to cancel subscription. Please try again." };
  }
}

/**
 * Reactivate a subscription that was marked to cancel at period end.
 */
export async function reactivateSubscription() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const business = await getCurrentBusiness();
    if (!business) return { error: "No business found." };

    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from("subscriptions")
      .update({
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return { success: true };
  } catch (err: any) {
    console.error("reactivateSubscription error:", err);
    return { error: "Failed to reactivate subscription. Please try again." };
  }
}

/**
 * Record a downgrade intent — no immediate charge change.
 * The actual downgrade takes effect at the next billing period.
 */
export async function requestDowngrade(targetPlan: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const business = await getCurrentBusiness();
    if (!business) return { error: "No business found." };

    const allowedDowngrades = ["starter"];
    if (!allowedDowngrades.includes(targetPlan)) {
      return { error: "Invalid target plan for downgrade." };
    }

    const serviceClient = createServiceClient();
    // Record intent in subscription metadata
    const { error } = await serviceClient
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        metadata: {
          downgrade_to: targetPlan,
          downgrade_requested_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return { success: true, message: `Your plan will be downgraded to ${targetPlan} at the end of your billing period.` };
  } catch (err: any) {
    console.error("requestDowngrade error:", err);
    return { error: "Failed to request downgrade. Please try again." };
  }
}

/**
 * Cancel a pending scheduled downgrade.
 */
export async function cancelPendingDowngrade() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const business = await getCurrentBusiness();
    if (!business) return { error: "No business found." };

    const serviceClient = createServiceClient();
    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("metadata")
      .eq("business_id", business.id)
      .maybeSingle();

    const cleanMetadata = { ...((sub?.metadata as Record<string, any>) || {}) };
    delete cleanMetadata.downgrade_to;
    delete cleanMetadata.downgrade_requested_at;

    const { error } = await serviceClient
      .from("subscriptions")
      .update({
        cancel_at_period_end: false,
        metadata: cleanMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath("/dashboard/billing");
    return { success: true, message: "Scheduled downgrade has been cancelled." };
  } catch (err: any) {
    console.error("cancelPendingDowngrade error:", err);
    return { error: "Failed to cancel scheduled downgrade. Please try again." };
  }
}

/**
 * Update billing profile information.
 */
export async function updateBillingInformation(data: {
  business_name?: string;
  contact_email?: string;
  phone?: string;
  address?: string;
  website_url?: string;
  billing_name?: string;
  country?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const business = await getCurrentBusiness();
    if (!business) return { error: "No business found." };

    const serviceClient = createServiceClient();

    // 1. Update business table fields
    const businessUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.business_name !== undefined) businessUpdate.name = data.business_name.trim();
    if (data.contact_email !== undefined) businessUpdate.contact_email = data.contact_email.trim();
    if (data.phone !== undefined) businessUpdate.phone = data.phone.trim();
    if (data.address !== undefined) businessUpdate.address = data.address.trim();
    if (data.website_url !== undefined) businessUpdate.website_url = data.website_url.trim();

    const { error: bizError } = await serviceClient
      .from("businesses")
      .update(businessUpdate)
      .eq("id", business.id);

    if (bizError) throw bizError;

    // 2. Update subscription metadata for billing_name and country
    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("metadata")
      .eq("business_id", business.id)
      .maybeSingle();

    const updatedMetadata = {
      ...((sub?.metadata as Record<string, any>) || {}),
      billing_name: data.billing_name?.trim() || "",
      country: data.country?.trim() || "NG",
    };

    const { error: subError } = await serviceClient
      .from("subscriptions")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id);

    if (subError) throw subError;

    revalidatePath("/dashboard/billing");
    return { success: true, message: "Billing details saved successfully." };
  } catch (err: any) {
    console.error("updateBillingInformation error:", err);
    return { error: "Failed to update billing details. Please try again." };
  }
}
