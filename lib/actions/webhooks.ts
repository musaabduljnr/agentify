"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";

async function getCurrentBusiness() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  return business;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string | null;
  event_type: string;
  target_url: string;
  status: "pending" | "success" | "failed" | "retrying";
  attempt_count: number;
  last_attempted_at: string | null;
  response_code: number | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface WebhookRecord {
  id: string;
  name: string;
  target_url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface WebhookStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
  avgDurationMs: number;
  last24h: number;
}

/**
 * Get webhook stats summary for the current business.
 */
export async function getWebhookStats(): Promise<WebhookStats> {
  try {
    const business = await getCurrentBusiness();
    if (!business) return { total: 0, success: 0, failed: 0, pending: 0, successRate: 0, avgDurationMs: 0, last24h: 0 };

    const supabase = await createClient();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: all }, { data: recent }] = await Promise.all([
      supabase
        .from("webhook_deliveries")
        .select("status, duration_ms")
        .eq("business_id", business.id),

      supabase
        .from("webhook_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .gte("created_at", last24h),
    ]);

    const deliveries = all || [];
    const total = deliveries.length;
    const success = deliveries.filter(d => d.status === "success").length;
    const failed = deliveries.filter(d => d.status === "failed").length;
    const pending = deliveries.filter(d => d.status === "pending" || d.status === "retrying").length;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    const durations = deliveries.filter(d => d.duration_ms != null).map(d => d.duration_ms as number);
    const avgDurationMs = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    return {
      total,
      success,
      failed,
      pending,
      successRate,
      avgDurationMs,
      last24h: (recent as any)?.length ?? 0,
    };
  } catch (err) {
    console.error("getWebhookStats error:", err);
    return { total: 0, success: 0, failed: 0, pending: 0, successRate: 0, avgDurationMs: 0, last24h: 0 };
  }
}

/**
 * Get paginated webhook deliveries.
 */
export async function getWebhookDeliveries(
  filter: "all" | "success" | "failed" | "pending" = "all",
  page: number = 1,
  pageSize: number = 20
): Promise<{ data: WebhookDelivery[]; total: number }> {
  try {
    const business = await getCurrentBusiness();
    if (!business) return { data: [], total: 0 };

    const supabase = await createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("webhook_deliveries")
      .select("id, webhook_id, event_type, target_url, status, attempt_count, last_attempted_at, response_code, error_message, duration_ms, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filter !== "all") {
      if (filter === "pending") {
        query = query.in("status", ["pending", "retrying"]);
      } else {
        query = query.eq("status", filter);
      }
    }

    const [{ data, error }, { count }] = await Promise.all([
      query,
      supabase
        .from("webhook_deliveries")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id),
    ]);

    if (error) throw error;
    return { data: (data || []) as WebhookDelivery[], total: count || 0 };
  } catch (err) {
    console.error("getWebhookDeliveries error:", err);
    return { data: [], total: 0 };
  }
}

/**
 * Get all webhooks registered by the business.
 */
export async function getWebhooks(): Promise<WebhookRecord[]> {
  try {
    const business = await getCurrentBusiness();
    if (!business) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("webhooks")
      .select("id, name, target_url, events, is_active, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as WebhookRecord[];
  } catch (err) {
    console.error("getWebhooks error:", err);
    return [];
  }
}

/**
 * Create a new webhook registration.
 */
export async function createWebhook(name: string, targetUrl: string, events: string[]) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return { error: "Unauthorized" };

    if (!targetUrl.startsWith("https://")) {
      return { error: "Webhook URL must use HTTPS." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("webhooks")
      .insert({
        business_id: business.id,
        name: name.trim(),
        target_url: targetUrl.trim(),
        events,
        is_active: true,
      });

    if (error) throw error;

    revalidatePath("/dashboard/settings/webhooks");
    return { success: true };
  } catch (err: any) {
    console.error("createWebhook error:", err);
    return { error: "Failed to create webhook. Please try again." };
  }
}

/**
 * Toggle webhook active state.
 */
export async function toggleWebhook(webhookId: string, isActive: boolean) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return { error: "Unauthorized" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("webhooks")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", webhookId)
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath("/dashboard/settings/webhooks");
    return { success: true };
  } catch (err: any) {
    console.error("toggleWebhook error:", err);
    return { error: "Failed to update webhook." };
  }
}

/**
 * Delete a webhook registration.
 */
export async function deleteWebhook(webhookId: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return { error: "Unauthorized" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("webhooks")
      .delete()
      .eq("id", webhookId)
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath("/dashboard/settings/webhooks");
    return { success: true };
  } catch (err: any) {
    console.error("deleteWebhook error:", err);
    return { error: "Failed to delete webhook." };
  }
}

/**
 * Manually retry a failed webhook delivery (re-insert as pending).
 */
export async function retryWebhookDelivery(deliveryId: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return { error: "Unauthorized" };

    const serviceClient = createServiceClient();

    const { data: delivery, error: fetchErr } = await serviceClient
      .from("webhook_deliveries")
      .select("*")
      .eq("id", deliveryId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (fetchErr || !delivery) return { error: "Delivery not found." };
    if (delivery.status === "success") return { error: "This delivery already succeeded." };

    const { error: updateErr } = await serviceClient
      .from("webhook_deliveries")
      .update({
        status: "retrying",
        next_retry_at: new Date().toISOString(),
        attempt_count: (delivery.attempt_count || 0) + 1,
      })
      .eq("id", deliveryId);

    if (updateErr) throw updateErr;

    revalidatePath("/dashboard/settings/webhooks");
    return { success: true };
  } catch (err: any) {
    console.error("retryWebhookDelivery error:", err);
    return { error: "Failed to retry delivery." };
  }
}
