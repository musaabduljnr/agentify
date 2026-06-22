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
import { revalidatePath } from "next/cache";

async function getCurrentBusiness() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
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

    const [planData, usage, billingSettings, effectivePlans] = await Promise.all([
      getCurrentPlan(business.id),
      getUsageSummary(business.id),
      getBillingPlatformSettings(),
      getEffectivePlanConfigs(),
    ]);

    if (!planData) return null;

    const { subscription, plan, planId } = planData;

    // Build plan comparison for all plans
    const plans = PLAN_ORDER.map((id) => {
      const config = effectivePlans[id];
      return {
        id,
        name: config.name,
        price: formatCurrencyAmount(config.price_ngn, billingSettings),
        price_ngn: config.price_ngn,
        features: config.features,
        isCurrent: id === planId,
        isUpgrade: PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(planId),
        isDowngrade: PLAN_ORDER.indexOf(id) < PLAN_ORDER.indexOf(planId),
      };
    });

    return {
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        payment_provider: subscription.payment_provider,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        reset_date: subscription.reset_date,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      currentPlan: {
        id: planId,
        name: plan.name,
        price: formatCurrencyAmount(plan.price_ngn, billingSettings),
        price_ngn: plan.price_ngn,
      },
      billingSettings,
      usage,
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

    const allowedDowngrades = ["free_trial", "starter"];
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
