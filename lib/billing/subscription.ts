"use server";

// ══════════════════════════════════════════════════════════════
// Subscription Helpers (Server-Side Only)
// ══════════════════════════════════════════════════════════════

import { createServiceClient } from "@/utils/supabase/service";
import { getPlanLimits, getPlanConfig, type PlanId } from "./plans";

export type Subscription = {
  id: string;
  business_id: string;
  plan: string;
  status: string;
  payment_provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  provider_plan_code: string | null;
  provider_reference: string | null;
  current_usage: number;
  message_limit: number;
  knowledge_limit: number;
  lead_limit: number;
  widget_limit: number;
  embedding_limit: number;
  reset_date: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

/**
 * Get the subscription for a business.
 */
export async function getBusinessSubscription(businessId: string): Promise<Subscription | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) return null;

  // Auto-reset if needed
  await resetMonthlyUsageIfNeeded(businessId, data);

  return data as Subscription;
}

/**
 * Require an active subscription — throws if not found or inactive.
 */
export async function requireActiveSubscription(businessId: string): Promise<Subscription> {
  const sub = await getBusinessSubscription(businessId);

  if (!sub) {
    throw new Error("No subscription found. Please set up your account.");
  }

  const activeStatuses = ["active", "trialing"];
  if (!activeStatuses.includes(sub.status)) {
    throw new Error(
      `Your subscription is ${sub.status}. Please update your billing to continue.`
    );
  }

  return sub;
}

/**
 * Sync subscription limits from a plan config.
 */
export async function syncSubscriptionLimitsFromPlan(
  businessId: string,
  plan: PlanId
): Promise<void> {
  const supabase = createServiceClient();
  const limits = getPlanLimits(plan);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan,
      ...limits,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  if (error) {
    console.error("Failed to sync subscription limits:", error);
    throw new Error("Failed to update subscription limits.");
  }
}

/**
 * Get the current plan config for a business.
 */
export async function getCurrentPlan(businessId: string) {
  const sub = await getBusinessSubscription(businessId);
  if (!sub) return null;

  const planConfig = getPlanConfig(sub.plan);
  return {
    subscription: sub,
    plan: planConfig,
    planId: sub.plan as PlanId,
  };
}

/**
 * Get remaining usage across all resource types.
 */
export async function getRemainingUsage(businessId: string) {
  const supabase = createServiceClient();
  const sub = await getBusinessSubscription(businessId);
  if (!sub) return null;

  // Get actual usage counts from usage_logs for the current period
  const periodStart = sub.current_period_start || sub.created_at;

  const { data: usageLogs } = await supabase
    .from("usage_logs")
    .select("type, amount")
    .eq("business_id", businessId)
    .gte("created_at", periodStart);

  const usageByType: Record<string, number> = {};
  (usageLogs || []).forEach((log: any) => {
    usageByType[log.type] = (usageByType[log.type] || 0) + log.amount;
  });

  return {
    messages: {
      used: usageByType["message"] || 0,
      limit: sub.message_limit,
      remaining: Math.max(0, sub.message_limit - (usageByType["message"] || 0)),
    },
    embeddings: {
      used: usageByType["embedding"] || 0,
      limit: sub.embedding_limit,
      remaining: Math.max(0, sub.embedding_limit - (usageByType["embedding"] || 0)),
    },
    leads: {
      used: usageByType["lead"] || 0,
      limit: sub.lead_limit,
      remaining: Math.max(0, sub.lead_limit - (usageByType["lead"] || 0)),
    },
    knowledge_sources: {
      used: usageByType["knowledge_source"] || 0,
      limit: sub.knowledge_limit,
      remaining: Math.max(0, sub.knowledge_limit - (usageByType["knowledge_source"] || 0)),
    },
  };
}

/**
 * Reset monthly usage if the reset date or period end has passed.
 * Called automatically when subscription is loaded.
 */
export async function resetMonthlyUsageIfNeeded(
  businessId: string,
  subscription?: any
): Promise<void> {
  const supabase = createServiceClient();

  let sub = subscription;
  if (!sub) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();
    sub = data;
  }

  if (!sub) return;

  const now = new Date();
  const resetDate = sub.reset_date ? new Date(sub.reset_date) : null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;

  const needsReset = (resetDate && now >= resetDate) || (periodEnd && now >= periodEnd);

  if (!needsReset) return;

  // Reset usage counter
  const nextResetDate = new Date();
  nextResetDate.setDate(nextResetDate.getDate() + 30);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      current_usage: 0,
      reset_date: nextResetDate.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: nextResetDate.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("business_id", businessId);

  if (error) {
    console.error("Failed to reset monthly usage:", error);
  }
}
