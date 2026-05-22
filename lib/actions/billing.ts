"use server";

// ══════════════════════════════════════════════════════════════
// Billing Server Actions (for dashboard)
// ══════════════════════════════════════════════════════════════

import { createClient } from "@/utils/supabase/server";
import { getBusinessSubscription, getCurrentPlan, getRemainingUsage } from "@/lib/billing/subscription";
import { getUsageSummary } from "@/lib/billing/usage";
import { getPlanConfig, PLAN_CONFIG, PLAN_ORDER, formatPlanPrice, type PlanId } from "@/lib/billing/plans";

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

    const [planData, usage] = await Promise.all([
      getCurrentPlan(business.id),
      getUsageSummary(business.id),
    ]);

    if (!planData) return null;

    const { subscription, plan, planId } = planData;

    // Build plan comparison for all plans
    const plans = PLAN_ORDER.map((id) => {
      const config = getPlanConfig(id);
      return {
        id,
        name: config.name,
        price: formatPlanPrice(config),
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
        price: formatPlanPrice(plan),
        price_ngn: plan.price_ngn,
      },
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
 * Returns warning data if usage is at 80% or 100%.
 */
export async function getUsageWarnings() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return [];

    const usage = await getUsageSummary(business.id);
    const warnings: {
      type: string;
      label: string;
      level: "warning" | "critical";
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
        warnings.push({ type, label, level: "critical", used: data.used, limit: data.limit, percentage: pct });
      } else if (pct >= 80) {
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
