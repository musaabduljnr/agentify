"use server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/utils/supabase/service";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getPlanLimits, PlanId } from "@/lib/billing/plans";
import { invalidateUsageCache } from "@/lib/billing/usage-cache";

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

// Zod Input Schemas
const changePlanSchema = z.object({
  subscriptionId: z.string().uuid(),
  plan: z.enum(["free_trial", "starter", "growth", "business", "enterprise"]),
  reason: z.string().optional(),
});

const changeStatusSchema = z.object({
  subscriptionId: z.string().uuid(),
  status: z.enum(["active", "trialing", "inactive", "suspended", "cancelled", "past_due"]),
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
  const admin = await requireAdmin();
  
  // Validate input
  const input = changePlanSchema.parse({ subscriptionId, plan, reason });
  const supabase = createServiceClient();

  // 1. Fetch current subscription to record old value
  const { data: currentSub, error: fetchError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", input.subscriptionId)
    .maybeSingle();

  if (fetchError || !currentSub) {
    return { error: fetchError?.message || "Subscription not found." };
  }

  // 2. Resolve default limits for the new plan
  const planLimits = getPlanLimits(input.plan);
  const now = new Date();
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  // 3. Update subscription safely
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      plan: input.plan,
      payment_provider: "manual",
      provider_reference: "admin_override",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      reset_date: periodEnd.toISOString(),
      cancel_at_period_end: false,
      ...planLimits,
      updated_at: now.toISOString(),
    })
    .eq("id", input.subscriptionId);

  if (updateError) {
    return { error: updateError.message };
  }

  // 4. Write audit log
  await writeAuditLog(admin.id, "subscription_plan_changed", input.subscriptionId, {
    business_id: currentSub.business_id,
    subscription_id: input.subscriptionId,
    old_value: currentSub.plan,
    new_value: input.plan,
    reason: input.reason || "Manual admin upgrade/downgrade",
    admin_id: admin.id,
  });

  // 5. Invalidate cached usage
  invalidateUsageCache(currentSub.business_id);

  revalidatePath("/admin/subscriptions");
  revalidatePath("/dashboard/billing");
  return { success: true };
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
  return { success: true };
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

  const fields = [
    "message_limit",
    "knowledge_limit",
    "lead_limit",
    "widget_limit",
    "embedding_limit",
    "current_usage",
  ] as const;

  for (const field of fields) {
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
  return { success: true };
}

/**
 * Admin action to reset usage counters.
 */
export async function adminResetSubscriptionUsage(subscriptionId: string, reason?: string) {
  const admin = await requireAdmin();

  // Validate input
  const input = resetUsageSchema.parse({ subscriptionId, reason });
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

  // 2. Update reset date (30 days out)
  const nextResetDate = new Date();
  nextResetDate.setDate(nextResetDate.getDate() + 30);

  // 3. Perform database update
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      current_usage: 0,
      reset_date: nextResetDate.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.subscriptionId);

  if (updateError) {
    return { error: updateError.message };
  }

  // 4. Write audit log
  await writeAuditLog(admin.id, "subscription_usage_reset", input.subscriptionId, {
    business_id: currentSub.business_id,
    subscription_id: input.subscriptionId,
    old_usage: currentSub.current_usage,
    new_usage: 0,
    reason: input.reason || "Manual usage counter reset",
    admin_id: admin.id,
  });

  // 5. Invalidate cached usage
  invalidateUsageCache(currentSub.business_id);

  revalidatePath("/admin/subscriptions");
  revalidatePath("/dashboard/billing");
  return { success: true };
}

/**
 * Admin action to extend the current period end date.
 */
export async function adminExtendSubscriptionPeriod(
  subscriptionId: string,
  extendByDays: number | string,
  reason?: string
) {
  const admin = await requireAdmin();

  // Validate input
  const input = extendPeriodSchema.parse({ subscriptionId, extendByDays, reason });
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

  // 2. Compute new period end
  let newPeriodEnd = new Date(currentSub.current_period_end || new Date());
  if (typeof input.extendByDays === "number") {
    newPeriodEnd.setDate(newPeriodEnd.getDate() + input.extendByDays);
  } else {
    // Custom ISO Date String
    newPeriodEnd = new Date(input.extendByDays);
  }

  // 3. Update subscription
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      current_period_end: newPeriodEnd.toISOString(),
      reset_date: newPeriodEnd.toISOString(), // sync reset date with new period end
      status: "active", // Reactivate if inactive/expired
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.subscriptionId);

  if (updateError) {
    return { error: updateError.message };
  }

  // 4. Write audit log
  await writeAuditLog(admin.id, "subscription_period_extended", input.subscriptionId, {
    business_id: currentSub.business_id,
    subscription_id: input.subscriptionId,
    old_period_end: currentSub.current_period_end,
    new_period_end: newPeriodEnd.toISOString(),
    reason: input.reason || "Manual subscription period extension",
    admin_id: admin.id,
  });

  // 5. Invalidate cached usage
  invalidateUsageCache(currentSub.business_id);

  revalidatePath("/admin/subscriptions");
  revalidatePath("/dashboard/billing");
  return { success: true };
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
  return { success: true };
}
