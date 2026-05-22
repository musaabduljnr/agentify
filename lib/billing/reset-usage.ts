"use server";

// ══════════════════════════════════════════════════════════════
// Monthly Usage Reset (Server-Side)
// ══════════════════════════════════════════════════════════════

import { createServiceClient } from "@/utils/supabase/service";

/**
 * Reset monthly usage for a specific business if the period has ended.
 * This is called automatically when the subscription is loaded,
 * and can also be called from a cron job for batch processing.
 */
export async function resetMonthlyUsageIfNeeded(businessId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!sub) return false;

  const now = new Date();
  const resetDate = sub.reset_date ? new Date(sub.reset_date) : null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;

  const needsReset = (resetDate && now >= resetDate) || (periodEnd && now >= periodEnd);
  if (!needsReset) return false;

  const nextReset = new Date();
  nextReset.setDate(nextReset.getDate() + 30);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      current_usage: 0,
      reset_date: nextReset.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: nextReset.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("business_id", businessId);

  if (error) {
    console.error("Failed to reset monthly usage:", error);
    return false;
  }

  console.log(`Monthly usage reset for business ${businessId}`);
  return true;
}

/**
 * Batch reset for all businesses whose period has ended.
 * Intended for use in a cron job / scheduled function.
 */
export async function resetAllExpiredBusinessUsage(): Promise<number> {
  const supabase = createServiceClient();

  const { data: expiredSubs } = await supabase
    .from("subscriptions")
    .select("business_id")
    .lte("current_period_end", new Date().toISOString())
    .in("status", ["active", "trialing"]);

  if (!expiredSubs || expiredSubs.length === 0) return 0;

  let resetCount = 0;
  for (const sub of expiredSubs) {
    const didReset = await resetMonthlyUsageIfNeeded(sub.business_id);
    if (didReset) resetCount++;
  }

  return resetCount;
}
