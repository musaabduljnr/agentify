"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { redactWebhookResponse, redactWebhookText, redactWebhookValue, validateWebhookUrl } from "@/lib/webhooks/security";
import { calculateWebhookStats } from "@/lib/webhooks/metrics";
import { normalizeDeliveryFilters, type DeliveryFilters, type DeliveryStatus } from "@/lib/webhooks/filters";
export type { DeliveryFilter, DeliveryFilters } from "@/lib/webhooks/filters";

const WEBHOOK_PATH = "/dashboard/settings/webhooks";
const PAGE_SIZE_MAX = 50;
const MAX_ATTEMPTS = 5;

export type WebhookStatus = DeliveryStatus;

export interface WebhookAttempt {
  id: string;
  delivery_id: string;
  attempt_number: number;
  outcome: "processing" | "succeeded" | "failed" | "interrupted";
  started_at: string;
  http_started_at: string | null;
  completed_at: string | null;
  response_code: number | null;
  response_body: string | null;
  error_message: string | null;
  duration_ms: number | null;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string | null;
  event_id: string;
  event_type: string;
  target_url: string;
  status: WebhookStatus;
  attempt_count: number;
  last_attempted_at: string | null;
  response_code: number | null;
  response_body: string | null;
  payload: unknown;
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
  max_attempts: number;
  created_at: string;
}

export interface WebhookStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  failedDeliveries: number;
  exhaustedDeliveries: number;
  pendingDeliveries: number;
  successRate: number;
  avgDurationMs: number;
  last24hAttempts: number;
}

export interface WebhookDeliveryDetails {
  delivery: WebhookDelivery;
  attempts: WebhookAttempt[];
}

async function getCurrentBusiness() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error("Unable to authenticate.");
  if (!user) return null;

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Unable to load the current business.");
  return business;
}

function isSupportedEvents(events: string[]): boolean {
  return events.length > 0 && events.every((event) => event === "lead.created");
}

function safePage(value: number, fallback: number): number {
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}

function safeWebhookDelivery(row: Record<string, unknown>): WebhookDelivery {
  return {
    ...(row as unknown as WebhookDelivery),
    payload: redactWebhookValue(row.payload),
    response_body: redactWebhookResponse(typeof row.response_body === "string" ? row.response_body : null),
    error_message: redactWebhookText(typeof row.error_message === "string" ? row.error_message : null),
  };
}

function safeAttempt(row: Record<string, unknown>): WebhookAttempt {
  return {
    ...(row as unknown as WebhookAttempt),
    response_body: redactWebhookResponse(typeof row.response_body === "string" ? row.response_body : null),
    error_message: redactWebhookText(typeof row.error_message === "string" ? row.error_message : null),
  };
}

export async function getWebhookStats(): Promise<WebhookStats> {
  const business = await getCurrentBusiness();
  const empty = {
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    failedDeliveries: 0,
    exhaustedDeliveries: 0,
    pendingDeliveries: 0,
    successRate: 0,
    avgDurationMs: 0,
    last24hAttempts: 0,
  };
  if (!business) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_webhook_delivery_stats", {
    p_business_id: business.id,
    p_since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error || !data || typeof data !== "object") {
    throw new Error("Unable to load webhook statistics.");
  }

  return calculateWebhookStats(data as Record<string, number | null>);
}

export async function getWebhookDeliveries(
  filters: DeliveryFilters = {},
  page = 1,
  pageSize = 20,
): Promise<{ data: WebhookDelivery[]; total: number; page: number; pageSize: number }> {
  const business = await getCurrentBusiness();
  const normalizedPage = safePage(page, 1);
  const normalizedSize = Math.min(safePage(pageSize, 20), PAGE_SIZE_MAX);
  if (!business) return { data: [], total: 0, page: normalizedPage, pageSize: normalizedSize };

  const supabase = await createClient();
  let query = supabase
    .from("webhook_deliveries")
    .select(
      "id, webhook_id, event_id, event_type, target_url, status, attempt_count, last_attempted_at, response_code, response_body, payload, error_message, duration_ms, created_at",
      { count: "exact" },
    )
    .eq("business_id", business.id);

  const normalizedFilters = normalizeDeliveryFilters(filters);
  if (normalizedFilters.status !== "all") {
    query = query.eq("status", normalizedFilters.status);
  }
  if (normalizedFilters.webhookId) query = query.eq("webhook_id", normalizedFilters.webhookId);
  if (normalizedFilters.eventType) query = query.eq("event_type", normalizedFilters.eventType);
  if (normalizedFilters.from) query = query.gte("created_at", normalizedFilters.from);
  if (normalizedFilters.to) query = query.lte("created_at", normalizedFilters.to);
  if (normalizedFilters.search) {
    query = query.or(`event_type.ilike.%${normalizedFilters.search}%,target_url.ilike.%${normalizedFilters.search}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range((normalizedPage - 1) * normalizedSize, normalizedPage * normalizedSize - 1);
  if (error) throw new Error("Unable to load webhook deliveries.");

  return {
    data: (data ?? []).map((row) => safeWebhookDelivery(row as Record<string, unknown>)),
    total: count ?? 0,
    page: normalizedPage,
    pageSize: normalizedSize,
  };
}

export async function getWebhookDeliveryDetails(deliveryId: string): Promise<WebhookDeliveryDetails | null> {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("webhook_deliveries")
    .select("id, webhook_id, retry_of, event_id, event_type, target_url, status, attempt_count, last_attempted_at, response_code, response_body, payload, error_message, duration_ms, created_at")
    .eq("id", deliveryId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (error) throw new Error("Unable to load webhook delivery details.");
  if (!row) return null;

  const relatedDeliveryIds = new Set<string>([deliveryId]);
  let frontier = [deliveryId];
  for (let depth = 0; frontier.length > 0 && depth < 20; depth++) {
    const { data: children, error: childrenError } = await supabase
      .from("webhook_deliveries")
      .select("id")
      .eq("business_id", business.id)
      .in("retry_of", frontier);
    if (childrenError) throw new Error("Unable to load retry history.");
    frontier = (children ?? []).map((child) => child.id).filter((id) => !relatedDeliveryIds.has(id));
    frontier.forEach((id) => relatedDeliveryIds.add(id));
  }
  let parentId = typeof row.retry_of === "string" ? row.retry_of : null;
  for (let depth = 0; parentId && depth < 20 && !relatedDeliveryIds.has(parentId); depth++) {
    relatedDeliveryIds.add(parentId);
    const { data: parent, error: parentError } = await supabase
      .from("webhook_deliveries")
      .select("id, retry_of")
      .eq("id", parentId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (parentError) throw new Error("Unable to load retry history.");
    parentId = typeof parent?.retry_of === "string" ? parent.retry_of : null;
  }

  const { data: attempts, error: attemptsError } = await supabase
    .from("webhook_delivery_attempts")
    .select("id, delivery_id, attempt_number, outcome, started_at, http_started_at, completed_at, response_code, response_body, error_message, duration_ms")
    .in("delivery_id", [...relatedDeliveryIds])
    .eq("business_id", business.id)
    .order("started_at", { ascending: true })
    .limit(200);
  if (attemptsError) throw new Error("Unable to load webhook attempt history.");
  return {
    delivery: safeWebhookDelivery(row as Record<string, unknown>),
    attempts: (attempts ?? []).map((attempt) => safeAttempt(attempt as Record<string, unknown>)),
  };
}

export async function getWebhooks(): Promise<WebhookRecord[]> {
  const business = await getCurrentBusiness();
  if (!business) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webhooks")
    .select("id, name, target_url, events, is_active, max_attempts, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load webhook registrations.");
  return (data ?? []) as WebhookRecord[];
}

export async function createWebhook(name: string, targetUrl: string, events: string[], maxAttempts = MAX_ATTEMPTS) {
  const business = await getCurrentBusiness();
  if (!business) return { error: "Unauthorized." };
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 100) return { error: "Name must be between 1 and 100 characters." };
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) {
    return { error: `Maximum attempts must be between 1 and ${MAX_ATTEMPTS}.` };
  }
  if (!Array.isArray(events) || !isSupportedEvents(events)) {
    return { error: "Select at least one supported event: lead.created." };
  }

  try {
    const { url } = await validateWebhookUrl(targetUrl.trim());
    const secret = randomBytes(32).toString("base64url");
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient.rpc("create_webhook_registration", {
      p_business_id: business.id,
      p_name: normalizedName,
      p_target_url: url.toString(),
      p_events: events,
      p_secret: secret,
      p_max_attempts: maxAttempts,
    });
    if (error || !data || typeof data !== "object") return { error: "Failed to create webhook." };

    revalidatePath(WEBHOOK_PATH);
    return { success: true, webhook: data as WebhookRecord, secret };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid endpoint URL." };
  }
}

export async function updateWebhook(
  webhookId: string,
  name: string,
  targetUrl: string,
  events: string[],
  maxAttempts = MAX_ATTEMPTS,
) {
  const business = await getCurrentBusiness();
  if (!business) return { error: "Unauthorized." };
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 100) return { error: "Name must be between 1 and 100 characters." };
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) {
    return { error: `Maximum attempts must be between 1 and ${MAX_ATTEMPTS}.` };
  }
  if (!isSupportedEvents(events)) return { error: "Select at least one supported event: lead.created." };

  try {
    const { url } = await validateWebhookUrl(targetUrl.trim());
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("webhooks")
      .update({ name: normalizedName, target_url: url.toString(), events, max_attempts: maxAttempts, updated_at: new Date().toISOString() })
      .eq("id", webhookId)
      .eq("business_id", business.id)
      .select("id, name, target_url, events, is_active, max_attempts, created_at")
      .maybeSingle();
    if (error || !data) return { error: "Unable to update this webhook." };
    revalidatePath(WEBHOOK_PATH);
    return { success: true, webhook: data as WebhookRecord };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid endpoint URL." };
  }
}

export async function toggleWebhook(webhookId: string, isActive: boolean) {
  const business = await getCurrentBusiness();
  if (!business) return { error: "Unauthorized." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webhooks")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", webhookId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Unable to update this webhook." };
  revalidatePath(WEBHOOK_PATH);
  return { success: true };
}

export async function deleteWebhook(webhookId: string) {
  const business = await getCurrentBusiness();
  if (!business) return { error: "Unauthorized." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", webhookId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Unable to delete this webhook." };
  revalidatePath(WEBHOOK_PATH);
  return { success: true };
}

export async function rotateWebhookSecret(webhookId: string) {
  const business = await getCurrentBusiness();
  if (!business) return { error: "Unauthorized." };
  const secret = randomBytes(32).toString("base64url");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webhooks")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", webhookId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Unable to rotate this webhook secret." };
  const serviceClient = createServiceClient();
  const { error: secretError } = await serviceClient
    .from("webhook_secrets")
    .upsert({ webhook_id: webhookId, secret, rotated_at: new Date().toISOString() });
  if (secretError) return { error: "Unable to rotate this webhook secret." };
  revalidatePath(WEBHOOK_PATH);
  return { success: true, secret };
}

export async function enqueueWebhookTest(webhookId: string) {
  const business = await getCurrentBusiness();
  if (!business) return { error: "Unauthorized." };
  const supabase = await createClient();
  const { data: webhook, error: fetchError } = await supabase
    .from("webhooks")
    .select("id, target_url, is_active, max_attempts")
    .eq("id", webhookId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (fetchError || !webhook) return { error: "Webhook not found." };
  if (!webhook.is_active) return { error: "Enable this endpoint before sending a test." };
  try {
    await validateWebhookUrl(webhook.target_url);
    const eventId = randomUUID();
    const payload = {
      schema_version: 1,
      event_id: eventId,
      type: "webhook.test",
      created_at: new Date().toISOString(),
      data: { message: "This is a test delivery from Agentify." },
    };
    const serviceClient = createServiceClient();
    const { error } = await serviceClient.from("webhook_deliveries").insert({
      business_id: business.id,
      webhook_id: webhook.id,
      event_id: eventId,
      event_type: "webhook.test",
      target_url: webhook.target_url,
      status: "pending",
      attempt_count: 0,
      max_attempts: webhook.max_attempts,
      next_retry_at: new Date().toISOString(),
      payload,
      manual_retry: true,
      is_test: true,
    });
    if (error) return { error: "Unable to queue the test delivery." };
    revalidatePath(WEBHOOK_PATH);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid endpoint URL." };
  }
}

export async function retryWebhookDelivery(deliveryId: string) {
  const business = await getCurrentBusiness();
  if (!business) return { error: "Unauthorized." };
  const supabase = await createClient();
  const { data: delivery, error: deliveryError } = await supabase
    .from("webhook_deliveries")
    .select("id, webhook_id, event_id, event_type, target_url, status, payload, max_attempts, is_test")
    .eq("id", deliveryId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (deliveryError || !delivery) return { error: "Delivery not found." };
  if (!["failed", "exhausted"].includes(delivery.status) || !delivery.webhook_id || !delivery.payload) {
    return { error: "Only failed or exhausted deliveries with an available endpoint can be retried." };
  }

  const { data: webhook, error: webhookError } = await supabase
    .from("webhooks")
    .select("id, target_url, is_active")
    .eq("id", delivery.webhook_id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (webhookError || !webhook) return { error: "Webhook not found." };
  if (!webhook.is_active) return { error: "Enable this endpoint before retrying." };

  try {
    await validateWebhookUrl(delivery.target_url);
    const serviceClient = createServiceClient();
    const { error } = await serviceClient.from("webhook_deliveries").insert({
      business_id: business.id,
      webhook_id: webhook.id,
      event_id: delivery.event_id,
      event_type: delivery.event_type,
      target_url: delivery.target_url,
      status: "pending",
      attempt_count: 0,
      max_attempts: Math.min(Number(delivery.max_attempts) || MAX_ATTEMPTS, MAX_ATTEMPTS),
      next_retry_at: new Date().toISOString(),
      payload: delivery.payload,
      manual_retry: true,
      is_test: delivery.is_test,
      retry_of: delivery.id,
    });
    if (error) return { error: "Unable to queue this retry." };
    revalidatePath(WEBHOOK_PATH);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid endpoint URL." };
  }
}
