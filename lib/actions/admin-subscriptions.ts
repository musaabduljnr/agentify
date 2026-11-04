"use server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/utils/supabase/service";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getPlanLimits, PlanId } from "@/lib/billing/plans";
import { invalidateUsageCache } from "@/lib/billing/usage-cache";
import { hasVerifiedPaymentForCurrentPeriod } from "@/lib/billing/entitlements";

// Audit log helper
async function writeAuditLog(
  adminId: string,
  action: string,
  resourceId: string,
  metadata: Record<string, any> = {}
) {
  try {
    const supabase = createServiceClient();
    await supabase.from("admin_audit_logs").insert({
      admin_id: adminId,
      action,
      resource_type: "subscription",
      resource_id: resourceId,
      metadata,
    });
  } catch (err) {
    console.error("Failed to write admin audit log:", err);
  }
}

// Helper to fetch full subscription details
async function fetchSubscriptionById(id: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("*, businesses(id, name, slug, owner:profiles(email, full_name))")
    .eq("id", id)
    .maybeSingle();
  return data;
}

// Zod Input Schemas
const changePlanSchema = z.object({
  subscriptionId: z.string().uuid(),
  plan: z.enum(["starter", "growth", "business", "enterprise"]),
  reason: z.string().optional(),
});

const changeStatusSchema = z.object({
  subscriptionId: z.string().uuid(),
  status: z.enum(["active", "trialing", "pending", "inactive", "suspended", "cancelled", "past_due"]),
  reason: z.string().optional(),
});

const updateLimitsSchema = z.object({
  subscriptionId: z.string().uuid(),
  limits: z.object({
    message_limit: z.number().nullable().optional(),
    knowledge_limit: z.number().nullable().optional(),
    lead_limit: z.number().nullable().optional(),
    widget_limit: z.number().nullable().optional(),
    embedding_limit: z.number().nullable().optional(),
    daily_message_limit: z.number().nullable().optional(),
    team_member_limit: z.number().nullable().optional(),
    current_usage: z.number().nullable().optional(),
  }),
  reason: z.string().optional(),
});

const resetUsageSchema = z.object({
  subscriptionId: z.string().uuid(),
  reason: z.string().optional(),
});

const extendPeriodSchema = z.object({
  subscriptionId: z.string().uuid(),
  extendByDays: z.union([z.number(), z.string()]), // number of days or ISO date string
  reason: z.string().optional(),
});

const updateNotesSchema = z.object({
  subscriptionId: z.string().uuid(),
  notes: z.string(),
});

/**
 * Fetch all subscriptions with business details, owner emails, and calculations.
 */
export async function getAllSubscriptions() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [subsResult, paymentsResult] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*, businesses(id, name, slug, owner:profiles(email, full_name))")
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_transactions")
      .select("business_id, amount")
      .eq("status", "success")
  ]);

  if (subsResult.error) throw subsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  const subscriptions = subsResult.data || [];
  const payments = paymentsResult.data || [];

  const revenueMap: Record<string, number> = {};
  for (const p of payments) {
    revenueMap[p.business_id] = (revenueMap[p.business_id] || 0) + (p.amount || 0);
  }

  const enrichedSubscriptions = subscriptions.map((sub: any) => {
    const revenue = revenueMap[sub.business_id] || 0;
    const currentUsage = sub.current_usage || 0;
    const estCost = currentUsage * 0.80; // ₦0.80 NGN per message
    const profit = revenue - estCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      ...sub,
      revenue,
      estCost,
      profit,
      margin,
    };
  });

  return enrichedSubscriptions;
}

/**
 * Get detailed parameters for a single subscription.
 */
export async function getSubscriptionDetails(subscriptionId: string) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("*, businesses(id, name, slug, owner:profiles(email, full_name))")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error) throw error;
  return sub;
}

/**
 * Admin action to change a subscription's plan tier.
 */
export async function adminChangeSubscriptionPlan(
  subscriptionId: string,
  plan: PlanId,
  reason?: string
) {
  await requireAdmin();
  changePlanSchema.parse({ subscriptionId, plan, reason });
  return {
    success: false,
    subscription: null,
    error: "Plan changes must be applied by a provider-verified successful payment.",
  };
}

/**
 * Admin action to change a subscription's active status.
 */
export async function adminChangeSubscriptionStatus(
  subscriptionId: string,
  status: string,
  reason?: string
) {
  const admin = await requireAdmin();

  // Validate input
  const input = changeStatusSchema.parse({ subscriptionId, status, reason });
  const supabase = createServiceClient();

  // 1. Fetch current subscription
  const { data: currentSub, error: fetchError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", input.subscriptionId)
    .maybeSingle();

  if (fetchError || !currentSub) {
    return { error: fetchError?.message || "Subscription not found." };
  }

  if (input.status === "active" && currentSub.status !== "active") {
    let hasVerifiedPayment: boolean;
    try {
      hasVerifiedPayment = await hasVerifiedPaymentForCurrentPeriod(currentSub);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unable to verify subscription payment." };
    }
    if (!hasVerifiedPayment) {
      return { error: "A verified successful payment for the current billing period is required." };
    }
  }

  // 2. Update status
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.subscriptionId);

  if (updateError) {
    return { error: updateError.message };
  }

  // 3. Write audit log
  await writeAuditLog(admin.id, "subscription_status_changed", input.subscriptionId, {
    business_id: currentSub.business_id,
    subscription_id: input.subscriptionId,
    old_value: currentSub.status,
    new_value: input.status,
    reason: input.reason || "Manual status update by admin",
    admin_id: admin.id,
  });

  // 4. Invalidate cached usage
  invalidateUsageCache(currentSub.business_id);

  revalidatePath("/admin/subscriptions");
  revalidatePath("/dashboard/billing");

  const updatedSubscription = await fetchSubscriptionById(input.subscriptionId);
  return { success: true, subscription: updatedSubscription };
}

/**
 * Admin action to override specific limits.
 */
export async function adminUpdateSubscriptionLimits(
  subscriptionId: string,
  limits: {
    message_limit?: number | null;
    knowledge_limit?: number | null;
    lead_limit?: number | null;
    widget_limit?: number | null;
    embedding_limit?: number | null;
    current_usage?: number | null;
  },
  reason?: string
) {
  const admin = await requireAdmin();

  // Validate input
  const input = updateLimitsSchema.parse({ subscriptionId, limits, reason });
  const supabase = createServiceClient();

  // 1. Fetch current subscription
  const { data: currentSub, error: fetchError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", input.subscriptionId)
    .maybeSingle();

  if (fetchError || !currentSub) {
    return { error: fetchError?.message || "Subscription not found." };
  }

  // 2. Prepare payload
  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  const oldValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};
  const officialLimits = ["starter", "growth"].includes(currentSub.plan)
    ? getPlanLimits(currentSub.plan as PlanId)
    : null;

  const fields = [
    "message_limit",
    "knowledge_limit",
    "lead_limit",
    "widget_limit",
    "embedding_limit",
    "daily_message_limit",
    "team_member_limit",
    "current_usage",
  ] as const;

  for (const field of fields) {
    const officialField = field === "message_limit"
      ? "message_limit"
      : field === "knowledge_limit"
        ? "knowledge_limit"
        : field === "lead_limit"
          ? "lead_limit"
          : field === "widget_limit"
            ? "widget_limit"
          : field === "daily_message_limit"
            ? "daily_message_limit"
          : null;

    if (officialLimits && officialField) {
      updatePayload[field] = officialLimits[officialField];
      oldValues[field] = currentSub[field];
      newValues[field] = officialLimits[officialField];
      continue;
    }

    if (input.limits.current_usage !== undefined) {
      return { error: "Usage is derived from completed usage records and cannot be changed manually." };
    }

    if (input.limits[field] !== undefined) {
      updatePayload[field] = input.limits[field];
      oldValues[field] = currentSub[field];
      newValues[field] = input.limits[field];
    }
  }

  // 3. Update subscription
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update(updatePayload)
    .eq("id", input.subscriptionId);

  if (updateError) {
    return { error: updateError.message };
  }

  // 4. Write audit log
  await writeAuditLog(admin.id, "subscription_limits_updated", input.subscriptionId, {
    business_id: currentSub.business_id,
    subscription_id: input.subscriptionId,
    old_value: oldValues,
    new_value: newValues,
    reason: input.reason || "Manual limit configuration",
    admin_id: admin.id,
  });

  // 5. Invalidate cached usage
  invalidateUsageCache(currentSub.business_id);

  revalidatePath("/admin/subscriptions");
  revalidatePath("/dashboard/billing");

  const updatedSubscription = await fetchSubscriptionById(input.subscriptionId);
  return { success: true, subscription: updatedSubscription };
}

/**
 * Admin action to reset usage counters.
 */
export async function adminResetSubscriptionUsage(subscriptionId: string, reason?: string) {
  await requireAdmin();
  resetUsageSchema.parse({ subscriptionId, reason });
  return {
    error: "Usage can only reset at a provider-verified billing-period boundary.",
  };
}

/**
 * Admin action to extend the current period end date.
 */
export async function adminExtendSubscriptionPeriod(
  subscriptionId: string,
  extendByDays: number | string,
  reason?: string
) {
  await requireAdmin();
  extendPeriodSchema.parse({ subscriptionId, extendByDays, reason });
  return {
    success: false,
    subscription: null,
    error: "Billing periods can only advance after a provider-verified successful payment.",
  };
}

/**
 * Admin action to save notes on a subscription account.
 */
export async function adminUpdateSubscriptionNotes(subscriptionId: string, notes: string) {
  const admin = await requireAdmin();

  // Validate input
  const input = updateNotesSchema.parse({ subscriptionId, notes });
  const supabase = createServiceClient();

  // 1. Fetch current subscription
  const { data: currentSub, error: fetchError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", input.subscriptionId)
    .maybeSingle();

  if (fetchError || !currentSub) {
    return { error: fetchError?.message || "Subscription not found." };
  }

  // 2. Merge metadata notes properties
  const existingMetadata = currentSub.metadata || {};
  const newMetadata = {
    ...existingMetadata,
    admin_notes: input.notes,
    last_admin_action: "notes_updated",
    last_admin_action_at: new Date().toISOString(),
    last_admin_action_by: admin.id,
  };

  // 3. Save to database
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      metadata: newMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.subscriptionId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/admin/subscriptions");
  
  const updatedSubscription = await fetchSubscriptionById(input.subscriptionId);
  return { success: true, subscription: updatedSubscription };
}
