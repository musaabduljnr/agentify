"use server";

// ══════════════════════════════════════════════════════════════
// Subscription Helpers (Server-Side Only)
// ══════════════════════════════════════════════════════════════

import { createServiceClient } from "@/utils/supabase/service";
import { type PlanId } from "./plans";
import { getEffectivePlanConfig, getEffectivePlanLimits } from "@/lib/billing/platform";
import { getUsageSummary } from "@/lib/billing/usage";

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

  const activeStatuses = ["active"];
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
  const limits = await getEffectivePlanLimits(plan);

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

  const planConfig = await getEffectivePlanConfig(sub.plan);
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
  return getUsageSummary(businessId);
}

/**
 * Reset monthly usage if the reset date or period end has passed.
 * Called automatically when subscription is loaded.
 */
export async function resetMonthlyUsageIfNeeded(
  businessId: string,
  subscription?: Subscription
): Promise<void> {
  // Billing periods advance only after a provider-verified payment event.
  void businessId;
  void subscription;
}
