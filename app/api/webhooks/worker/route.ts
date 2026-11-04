import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { postWebhook, redactWebhookResponse, verifyCronSecret } from "@/lib/webhooks/security";
import { canRetryWebhook, isRetryableWebhookStatus, webhookRetryDelayMs } from "@/lib/webhooks/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 10;

interface ClaimedDelivery {
  id: string;
  webhook_id: string;
  business_id: string;
  event_id: string;
  event_type: string;
  target_url: string;
  payload: unknown;
  attempt_count: number;
  max_attempts: number;
  attempt_id: string;
}

async function handleClaimedDelivery(
  supabase: ReturnType<typeof createServiceClient>,
  delivery: ClaimedDelivery,
) {
  const attemptStartedAt = Date.now();
  let status: "delivered" | "failed" | "retrying" | "exhausted";
  let responseCode: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;
  let durationMs: number | null = null;
  let nextRetryAt: string | null = null;

  try {
    const { data: endpoint, error: endpointError } = await supabase
      .from("webhooks")
      .select("is_active")
      .eq("id", delivery.webhook_id)
      .eq("business_id", delivery.business_id)
      .maybeSingle();

    if (endpointError) {
      throw new Error("Unable to load endpoint; retry delivery.");
    }
    if (!endpoint || !endpoint.is_active) {
      status = "failed";
      errorMessage = "The endpoint is no longer available or active.";
    } else if (!delivery.payload || typeof delivery.payload !== "object") {
      status = "failed";
      errorMessage = "The event payload is unavailable.";
    } else {
      const { data: secretRecord, error: secretError } = await supabase
        .from("webhook_secrets")
        .select("secret")
        .eq("webhook_id", delivery.webhook_id)
        .maybeSingle();
      if (secretError) {
        throw new Error("Unable to load signing secret; retry delivery.");
      }
      if (!secretRecord?.secret) {
        status = "failed";
        errorMessage = "The endpoint signing secret is unavailable.";
      } else {
        const result = await postWebhook(
          delivery.target_url,
          secretRecord.secret,
          delivery.event_id,
          delivery.event_type,
          delivery.payload,
          5_000,
          async () => {
            const { error } = await supabase
              .from("webhook_delivery_attempts")
              .update({ http_started_at: new Date().toISOString() })
              .eq("id", delivery.attempt_id)
              .eq("outcome", "processing");
            if (error) throw new Error("Unable to record attempt start.");
          },
        );
        responseCode = result.statusCode;
        responseBody = redactWebhookResponse(result.responseBody);
        durationMs = result.durationMs;

        if (responseCode >= 200 && responseCode < 300) {
          status = "delivered";
        } else if (isRetryableWebhookStatus(responseCode)) {
          if (canRetryWebhook(delivery.attempt_count, delivery.max_attempts)) {
            status = "retrying";
            nextRetryAt = new Date(Date.now() + webhookRetryDelayMs(delivery.attempt_count)).toISOString();
          } else {
            status = "exhausted";
          }
          errorMessage = `Endpoint returned HTTP ${responseCode}.`;
        } else {
          status = "failed";
          errorMessage = `Endpoint returned HTTP ${responseCode}.`;
        }
      }
    }
  } catch (error) {
    durationMs = Date.now() - attemptStartedAt;
    const retryable = canRetryWebhook(delivery.attempt_count, delivery.max_attempts);
    const endpointUnavailable = error instanceof Error && (
      error.message.includes("public IP addresses") ||
      error.message.includes("public HTTPS") ||
      error.message.includes("port 443")
    );
    status = endpointUnavailable ? "failed" : retryable ? "retrying" : "exhausted";
    nextRetryAt = retryable
      && !endpointUnavailable
      ? new Date(Date.now() + webhookRetryDelayMs(delivery.attempt_count)).toISOString()
      : null;
    errorMessage = error instanceof Error && error.message === "Request timed out"
      ? "Endpoint request timed out."
      : "Endpoint request failed validation or could not connect.";
  }

  const { data, error } = await supabase.rpc("complete_webhook_delivery_attempt", {
    p_delivery_id: delivery.id,
    p_attempt_id: delivery.attempt_id,
    p_outcome: status,
    p_response_code: responseCode,
    p_response_body: responseBody,
    p_error_message: errorMessage,
    p_duration_ms: durationMs,
    p_next_retry_at: nextRetryAt,
  });
  return !error && data === true;
}

async function runWorker(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!secret) return NextResponse.json({ error: "Worker is not configured." }, { status: 503 });
  if (!verifyCronSecret(secret, provided)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("claim_webhook_deliveries", { p_limit: BATCH_SIZE });
  if (error) return NextResponse.json({ error: "Unable to claim deliveries." }, { status: 500 });

  const deliveries = (data ?? []) as unknown as ClaimedDelivery[];
  const results = await Promise.all(deliveries.map(async (delivery) => {
    try {
      return await handleClaimedDelivery(supabase, delivery);
    } catch {
      return false;
    }
  }));
  return NextResponse.json({
    claimed: deliveries.length,
    completed: results.filter(Boolean).length,
    failedToSave: results.filter((result) => !result).length,
  });
}

export const GET = runWorker;
export const POST = runWorker;
