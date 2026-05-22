"use server";

// ══════════════════════════════════════════════════════════════
// Usage Tracking (Server-Side Only)
// ══════════════════════════════════════════════════════════════

import { createServiceClient } from "@/utils/supabase/service";

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
