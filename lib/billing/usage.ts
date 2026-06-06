"use server";

// ══════════════════════════════════════════════════════════════
// Usage Tracking (Server-Side Only)
// ══════════════════════════════════════════════════════════════

import { createServiceClient } from "@/utils/supabase/service";
import { getEffectivePlanConfig } from "@/lib/billing/platform";

export type UsageType = "message" | "embedding" | "lead" | "knowledge_source" | "widget_chat";

// Maps usage types to their limit columns on the subscription
const USAGE_LIMIT_MAP: Record<UsageType, string> = {
  message: "message_limit",
  widget_chat: "message_limit", // widget chats count against message limit
  embedding: "embedding_limit",
  lead: "lead_limit",
  knowledge_source: "knowledge_limit",
};

/**
 * Increment usage for a business. Inserts a usage_log and updates current_usage.
 */
export async function incrementUsage(
  businessId: string,
  type: UsageType,
  amount: number = 1,
  metadata?: Record<string, any>
): Promise<void> {
  const supabase = createServiceClient();

  // Get the subscription ID
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();

  // Insert usage log
  await supabase.from("usage_logs").insert({
    business_id: businessId,
    subscription_id: sub?.id || null,
    type,
    amount,
    metadata: metadata || {},
  });

  // Also increment the simple current_usage counter for messages
  if (type === "message" || type === "widget_chat") {
    await supabase.rpc("increment_subscription_usage", {
      p_business_id: businessId,
      p_amount: amount,
    }).then(({ error }) => {
      // Fallback: update directly if RPC doesn't exist
      if (error) {
        supabase
          .from("subscriptions")
          .update({
            current_usage: (sub as any)?.current_usage 
              ? (sub as any).current_usage + amount 
              : amount,
          })
          .eq("business_id", businessId)
          .then(() => {});
      }
    });
  }
}

/**
 * Check if a business has usage capacity for a given type.
 * Returns { allowed, used, limit, remaining }.
 */
export async function checkUsageLimit(
  businessId: string,
  type: UsageType
): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  const supabase = createServiceClient();

  // 1. Get subscription
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!sub) {
    return { allowed: false, used: 0, limit: 0, remaining: 0 };
  }

  // 2. Get the limit for this usage type
  const limitColumn = USAGE_LIMIT_MAP[type];
  const limit = (sub as any)[limitColumn] as number;

  // If limit is very large (enterprise), always allow
  if (limit >= 999999999) {
    return { allowed: true, used: 0, limit, remaining: limit };
  }

  // 3. Count actual usage in current period
  const periodStart = sub.current_period_start || sub.created_at;
  
  // For widget_chat, we count it as "message" type in logs
  const logType = type === "widget_chat" ? "message" : type;
  // Also include widget_chat logs in message count
  let totalUsed = 0;

  if (type === "message" || type === "widget_chat") {
    // Count both message and widget_chat against message_limit
    const { data: usageLogs } = await supabase
      .from("usage_logs")
      .select("amount")
      .eq("business_id", businessId)
      .in("type", ["message", "widget_chat"])
      .gte("created_at", periodStart);

    totalUsed = (usageLogs || []).reduce((sum: number, log: any) => sum + log.amount, 0);
  } else {
    const { data: usageLogs } = await supabase
      .from("usage_logs")
      .select("amount")
      .eq("business_id", businessId)
      .eq("type", logType)
      .gte("created_at", periodStart);

    totalUsed = (usageLogs || []).reduce((sum: number, log: any) => sum + log.amount, 0);
  }

  const remaining = Math.max(0, limit - totalUsed);

  return {
    allowed: totalUsed < limit,
    used: totalUsed,
    limit,
    remaining,
  };
}

/**
 * Get a complete usage summary for a business.
 */
export async function getUsageSummary(businessId: string) {
  const [messages, embeddings, leads, knowledge] = await Promise.all([
    checkUsageLimit(businessId, "message"),
    checkUsageLimit(businessId, "embedding"),
    checkUsageLimit(businessId, "lead"),
    checkUsageLimit(businessId, "knowledge_source"),
  ]);

  return {
    messages,
    embeddings,
    leads,
    knowledge_sources: knowledge,
  };
}

/**
 * Get remaining usage for a specific type.
 */
export async function getRemainingUsage(
  businessId: string,
  type: UsageType
): Promise<number> {
  const result = await checkUsageLimit(businessId, type);
  return result.remaining;
}

/**
 * Get the usage percentage for a given type (0-100).
 */
export async function getUsagePercentage(
  businessId: string,
  type: UsageType
): Promise<number> {
  const result = await checkUsageLimit(businessId, type);
  if (result.limit === 0) return 100;
  if (result.limit >= 999999999) return 0;
  return Math.min(100, Math.round((result.used / result.limit) * 100));
}

/**
 * Centrally verify if a business has usage capacity before firing AI requests.
 * Enforces subscription status, monthly plan limits, daily cap, and global free requests.
 */
export async function verifyAIUsageLimits(businessId: string): Promise<{
  allowed: boolean;
  reason?: "monthly_limit" | "daily_limit" | "global_free_limit" | "inactive_subscription" | "no_subscription";
  message?: string;
  used?: number;
  limit?: number;
}> {
  const supabase = createServiceClient();

  // 1. Get subscription
  const { data: sub, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (subError || !sub) {
    return {
      allowed: false,
      reason: "no_subscription",
      message: "No subscription found. Please set up your account."
    };
  }

  // 2. Check active subscription status
  const activeStatuses = ["active", "trialing"];
  if (!activeStatuses.includes(sub.status)) {
    return {
      allowed: false,
      reason: "inactive_subscription",
      message: `Your subscription is ${sub.status}. Please update your billing to continue.`
    };
  }

  // 3. Check Monthly Message Quota
  const monthlyLimit = sub.message_limit;
  const periodStart = sub.current_period_start || sub.created_at;

  const { data: monthlyLogs } = await supabase
    .from("usage_logs")
    .select("amount")
    .eq("business_id", businessId)
    .in("type", ["message", "widget_chat"])
    .gte("created_at", periodStart);

  const monthlyUsed = (monthlyLogs || []).reduce((sum: number, log: any) => sum + log.amount, 0);
  if (monthlyUsed >= monthlyLimit) {
    return {
      allowed: false,
      reason: "monthly_limit",
      message: "You've reached your monthly AI message limit. Please upgrade your plan to continue.",
      used: monthlyUsed,
      limit: monthlyLimit
    };
  }

  // 4. Check Daily Business Cap Limit
  const plan = sub.plan;
  const effectivePlan = await getEffectivePlanConfig(plan);
  
  // Daily cap limit: metadata override OR plan configuration default
  const dailyLimit = sub.metadata?.daily_message_limit ?? effectivePlan.daily_messages ?? 999999999;
  
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const { data: dailyLogs } = await supabase
    .from("usage_logs")
    .select("amount")
    .eq("business_id", businessId)
    .in("type", ["message", "widget_chat"])
    .gte("created_at", startOfToday.toISOString());

  const dailyUsed = (dailyLogs || []).reduce((sum: number, log: any) => sum + log.amount, 0);
  if (dailyUsed >= dailyLimit) {
    return {
      allowed: false,
      reason: "daily_limit",
      message: "You've reached your daily AI message limit. Please try again tomorrow or upgrade your plan.",
      used: dailyUsed,
      limit: dailyLimit
    };
  }

  // 5. If free plan, check Global Free Daily Quota
  if (plan === "free_trial") {
    // Get all free subscriptions
    const { data: freeSubs } = await supabase
      .from("subscriptions")
      .select("business_id")
      .eq("plan", "free_trial");

    const freeBizIds = (freeSubs || []).map((s: any) => s.business_id);

    if (freeBizIds.length > 0) {
      const { data: globalLogs } = await supabase
        .from("usage_logs")
        .select("amount")
        .in("business_id", freeBizIds)
        .in("type", ["message", "widget_chat"])
        .gte("created_at", startOfToday.toISOString());

      const globalUsed = (globalLogs || []).reduce((sum: number, log: any) => sum + log.amount, 0);
      const globalLimit = 1000;
      
      if (globalUsed >= globalLimit) {
        return {
          allowed: false,
          reason: "global_free_limit",
          message: "Free AI capacity has been reached for today. Please try again tomorrow or upgrade your plan.",
          used: globalUsed,
          limit: globalLimit
        };
      }
    }
  }

  return { allowed: true };
}
