import "server-only";

// ══════════════════════════════════════════════════════════════
// Usage Tracking (Server-Side Only)
// ══════════════════════════════════════════════════════════════

import { createServiceClient } from "@/utils/supabase/service";
import { getCachedUsage, setCachedUsage, invalidateUsageCache } from "@/lib/billing/usage-cache";
import { resolveBusinessEntitlements } from "@/lib/billing/entitlements";

export type UsageType = "message" | "embedding" | "lead" | "knowledge_source" | "widget_chat";
type ReservationType = UsageType | "assistant" | "team_member";
export type UsageReservation = { operationId: string; businessId: string };

type QuotaReservationResult = {
  allowed: boolean;
  reason?: string;
  used?: number;
  limit?: number;
};

export function getQuotaDenialMessage(reason: string | undefined, resource: string): string {
  if (reason === "no_subscription" || reason === "inactive_subscription" || reason === "expired_period") {
    return "An active subscription is required to use this feature.";
  }
  if (reason === "unknown_plan") {
    return "Your subscription plan could not be verified. Please contact support.";
  }
  if (reason === "lookup_failed") {
    return "Unable to verify your subscription. Please try again.";
  }
  return `You've reached your ${resource} limit for this plan. Please upgrade to continue.`;
}

export async function reserveUsageQuota(
  businessId: string,
  type: ReservationType,
  amount = 1,
  metadata: Record<string, unknown> = {}
): Promise<{ reservation: UsageReservation | null; reason?: string }> {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error("Quota reservation amount must be a positive integer.");
  }

  const entitlements = await resolveBusinessEntitlements(businessId);
  if (!entitlements.active) return { reservation: null, reason: entitlements.reason };

  const operationId = crypto.randomUUID();
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("reserve_subscription_quota", {
    p_business_id: businessId,
    p_type: type,
    p_amount: amount,
    p_operation_id: operationId,
    p_metadata: metadata,
  });

  if (error) {
    console.error("[Usage] Failed to reserve subscription quota", {
      businessId,
      type,
      amount,
      error,
    });
    throw new Error("Unable to verify subscription capacity. Please try again.");
  }

  const result = data as QuotaReservationResult;
  if (!result?.allowed) return { reservation: null, reason: result?.reason || "quota_denied" };
  return { reservation: { operationId, businessId } };
}

export async function completeUsageQuota(reservation: UsageReservation): Promise<void> {
  const { error, data } = await createServiceClient().rpc("finalize_subscription_quota", {
    p_operation_id: reservation.operationId,
  });
  if (error || data !== true) {
    console.error("[Usage] Failed to finalize subscription quota reservation", {
      operationId: reservation.operationId,
      error,
    });
    throw new Error("Unable to finalize subscription usage.");
  }
  invalidateUsageCache(reservation.businessId);
}

export async function releaseUsageQuota(reservation: UsageReservation): Promise<void> {
  const { error } = await createServiceClient().rpc("release_subscription_quota", {
    p_operation_id: reservation.operationId,
  });
  if (error) {
    console.error("[Usage] Failed to release subscription quota reservation", {
      operationId: reservation.operationId,
      error,
    });
    throw new Error("Unable to release subscription usage reservation.");
  }
  invalidateUsageCache(reservation.businessId);
}

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
      if (error) {
        console.warn("[Usage] increment_subscription_usage RPC failed", error);
      }
    });
  }

  // Invalidate cache on every write so next check is fresh
  invalidateUsageCache(businessId);
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
  const { data: sub, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (subscriptionError) {
    console.error("[Usage] Failed to load subscription usage period", {
      businessId,
      error: subscriptionError,
    });
    throw new Error("Unable to verify your subscription usage.");
  }
  if (!sub) {
    return { allowed: false, used: 0, limit: 0, remaining: 0 };
  }

  const entitlements = await resolveBusinessEntitlements(businessId);
  if (!entitlements.active) {
    return { allowed: false, used: 0, limit: 0, remaining: 0 };
  }

  const limit = type === "message" || type === "widget_chat"
    ? entitlements.limits.messages
    : type === "embedding"
      ? entitlements.limits.embeddings
      : type === "lead"
        ? entitlements.limits.leads
        : entitlements.limits.knowledgeSources;

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
      .eq("status", "completed")
      .gte("created_at", periodStart);

    totalUsed = (usageLogs || []).reduce((sum: number, log: any) => sum + log.amount, 0);
  } else if (type === "knowledge_source") {
    const { count, error } = await supabase
      .from("knowledge_sources")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId);
    if (error) {
      console.error("[Usage] Failed to count knowledge sources", { businessId, error });
      throw new Error("Unable to verify knowledge source usage.");
    }
    totalUsed = count || 0;
  } else if (type === "lead") {
    const [{ count, error }, { data: usageLogs, error: usageError }] = await Promise.all([
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("created_at", periodStart),
      supabase
        .from("usage_logs")
        .select("amount")
        .eq("business_id", businessId)
        .eq("type", "lead")
        .eq("status", "completed")
        .gte("created_at", periodStart),
    ]);
    if (error || usageError) {
      console.error("[Usage] Failed to count lead usage", { businessId, error, usageError });
      throw new Error("Unable to verify lead usage.");
    }
    const loggedUsage = (usageLogs || []).reduce((sum: number, log: any) => sum + log.amount, 0);
    totalUsed = Math.max(count || 0, loggedUsage);
  } else {
    const { data: usageLogs } = await supabase
      .from("usage_logs")
      .select("amount")
      .eq("business_id", businessId)
      .eq("type", logType)
      .eq("status", "completed")
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
 * Uses cache when available; falls back to DB on miss.
 */
export async function getUsageSummary(businessId: string) {
  // Check cache first
  const cached = getCachedUsage(businessId);
  if (cached) {
    return {
      messages: cached.messages,
      embeddings: cached.embeddings,
      leads: cached.leads,
      knowledge_sources: cached.knowledge_sources,
    };
  }

  const [messages, embeddings, leads, knowledge] = await Promise.all([
    checkUsageLimit(businessId, "message"),
    checkUsageLimit(businessId, "embedding"),
    checkUsageLimit(businessId, "lead"),
    checkUsageLimit(businessId, "knowledge_source"),
  ]);

  const snapshot = { messages, embeddings, leads, knowledge_sources: knowledge };

  // Populate cache
  setCachedUsage(businessId, snapshot);

  return snapshot;
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
  reason?: string;
  message?: string;
  used?: number;
  limit?: number;
}> {
  const entitlements = await resolveBusinessEntitlements(businessId);
  if (!entitlements.active || !entitlements.canUseAi) {
    return {
      allowed: false,
      reason: entitlements.reason,
      message: entitlements.reason === "active"
        ? "AI access is not included in your current plan."
        : "An active subscription is required to use AI features.",
    };
  }

  const supabase = createServiceClient();

  // 1. Get subscription
  const { data: sub, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (subError) {
    console.error("[Usage] Failed to verify AI subscription", { businessId, error: subError });
    return {
      allowed: false,
      reason: "lookup_failed",
      message: "Unable to verify your subscription. Please try again.",
    };
  }
  if (!sub) {
    return {
      allowed: false,
      reason: "no_subscription",
      message: "No subscription found. Please set up your account."
    };
  }

  // 2. Check active subscription status
  const activeStatuses = ["active"];
  if (!activeStatuses.includes(sub.status)) {
    return {
      allowed: false,
      reason: "inactive_subscription",
      message: `Your subscription is ${sub.status}. Please update your billing to continue.`
    };
  }

  // 3. Check Monthly Message Quota
  const monthlyLimit = entitlements.limits.messages;
  const periodStart = sub.current_period_start || sub.created_at;

  const { data: monthlyLogs, error: monthlyError } = await supabase
    .from("usage_logs")
    .select("amount")
    .eq("business_id", businessId)
    .in("type", ["message", "widget_chat"])
    .eq("status", "completed")
    .gte("created_at", periodStart);

  if (monthlyError) {
    console.error("[Usage] Failed to read monthly AI usage", { businessId, error: monthlyError });
    return { allowed: false, reason: "lookup_failed", message: "Unable to verify your usage. Please try again." };
  }
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
  const dailyLimit = entitlements.limits.dailyMessages;
  
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const { data: dailyLogs, error: dailyError } = await supabase
    .from("usage_logs")
    .select("amount")
    .eq("business_id", businessId)
    .in("type", ["message", "widget_chat"])
    .eq("status", "completed")
    .gte("created_at", startOfToday.toISOString());

  if (dailyError) {
    console.error("[Usage] Failed to read daily AI usage", { businessId, error: dailyError });
    return { allowed: false, reason: "lookup_failed", message: "Unable to verify your usage. Please try again." };
  }
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

  return { allowed: true };
}
