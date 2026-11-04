import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createWebhookSignature,
  isPublicAddress,
  redactWebhookText,
  redactWebhookValue,
  validateWebhookUrl,
  verifyCronSecret,
} from "@/lib/webhooks/security";
import { calculateWebhookStats } from "@/lib/webhooks/metrics";
import { normalizeDeliveryFilters } from "@/lib/webhooks/filters";
import {
  canRetryWebhook,
  isRetryableWebhookStatus,
  webhookRetryDelayMs,
} from "@/lib/webhooks/retry";

const webhookMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261104160000_outbound_webhooks.sql"),
  "utf8",
);
const attemptMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261104170000_webhook_attempt_history.sql"),
  "utf8",
);
const webhookActions = readFileSync(
  join(process.cwd(), "lib", "actions", "webhooks.ts"),
  "utf8",
);
const webhookWorker = readFileSync(
  join(process.cwd(), "app", "api", "webhooks", "worker", "route.ts"),
  "utf8",
);

describe("outbound webhook security", () => {
  it("accepts only HTTPS public destinations and rejects mixed DNS answers", async () => {
    const addresses = [{ address: "8.8.8.8", family: 4 }];
    await expect(validateWebhookUrl("https://example.com/hook", async () => addresses))
      .resolves.toMatchObject({ url: expect.any(URL), addresses });
    await expect(validateWebhookUrl("http://example.com/hook")).rejects.toThrow("public HTTPS");
    await expect(validateWebhookUrl("https://example.com:8443/hook")).rejects.toThrow("port 443");
    await expect(validateWebhookUrl("https://example.com/hook?token=secret")).rejects.toThrow("query strings");
    await expect(validateWebhookUrl("https://127.0.0.1/hook")).rejects.toThrow("public IP addresses");
    await expect(validateWebhookUrl("https://metadata.google.internal/hook", async () => [
      { address: "169.254.169.254", family: 4 },
    ])).rejects.toThrow("public IP addresses");
    await expect(validateWebhookUrl("https://example.com/hook", async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.4", family: 4 },
    ])).rejects.toThrow("public IP addresses");
  });

  it("classifies common private, local, metadata and public IP ranges", () => {
    for (const address of [
      "0.0.0.0",
      "10.0.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.20.1.1",
      "192.168.1.10",
      "224.0.0.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "2001:db8::1",
    ]) expect(isPublicAddress(address)).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("signs exact request bytes and validates the scheduled-worker bearer secret", () => {
    const body = '{"event_id":"evt-1","type":"lead.created"}';
    const signature = createWebhookSignature("endpoint-secret", body);
    expect(signature).toMatch(/^v1=[a-f0-9]{64}$/);
    expect(createWebhookSignature("endpoint-secret", body)).toBe(signature);
    expect(verifyCronSecret("cron-key", "cron-key")).toBe(true);
    expect(verifyCronSecret("cron-key", "wrong")).toBe(false);
    expect(verifyCronSecret(undefined, "cron-key")).toBe(false);
  });

  it("redacts sensitive payload keys and response content", () => {
    expect(redactWebhookValue({ name: "Ada", email: "ada@example.com", lead_id: "id" })).toEqual({
      name: "[REDACTED]",
      email: "[REDACTED]",
      lead_id: "id",
    });
    expect(redactWebhookText('{"name":"Ada","result":"ok"}')).toContain('"name":"[REDACTED]"');
    expect(redactWebhookText("email: ada@example.com")).toContain("[REDACTED_EMAIL]");
  });
});

describe("webhook delivery policy", () => {
  it("durably dispatches only persisted lead creation with stable, endpoint-idempotent event IDs", () => {
    expect(webhookMigration).toContain("AFTER INSERT ON public.leads");
    expect(webhookMigration).toContain("'event_id', NEW.id");
    expect(webhookMigration).toContain("webhook_deliveries_event_endpoint_unique");
    expect(webhookMigration).toContain("ON CONFLICT (webhook_id, event_id)");
    expect(webhookMigration).toContain("DO NOTHING");
    expect(webhookMigration).toContain("w.events @> ARRAY['lead.created']::TEXT[]");
  });

  it("persists an endpoint-configured maximum retry count within the supported bound", () => {
    expect(webhookMigration).toContain("ADD COLUMN IF NOT EXISTS max_attempts SMALLINT NOT NULL DEFAULT 5");
    expect(webhookMigration).toContain("CHECK (max_attempts BETWEEN 1 AND 5)");
    expect(webhookMigration).toContain("p_max_attempts SMALLINT");
    expect(webhookMigration).toContain("w.max_attempts, NOW(), v_payload");
  });

  it("claims due deliveries atomically and skips rows locked by other worker runs", () => {
    expect(webhookMigration).toContain("FUNCTION public.claim_webhook_deliveries");
    expect(webhookMigration).toContain("FOR UPDATE OF d SKIP LOCKED");
    expect(webhookMigration).toContain("attempt_count = d.attempt_count + 1");
  });

  it("allows only one manual retry child per failed delivery row", () => {
    expect(webhookMigration).toContain("webhook_deliveries_single_manual_retry_idx");
    expect(webhookMigration).toContain("ON public.webhook_deliveries (retry_of)");
  });

  it("migrates to explicit delivery states and recovers interrupted processing leases", () => {
    expect(attemptMigration).toContain("WHEN 'success' THEN 'delivered'");
    expect(attemptMigration).toContain("WHEN 'retrying' THEN 'pending'");
    expect(attemptMigration).toContain("'pending', 'processing', 'delivered', 'retrying', 'failed', 'exhausted'");
    expect(attemptMigration).toContain("outcome = 'interrupted'");
    expect(attemptMigration).toContain("d.claimed_at <= NOW() - INTERVAL '2 minutes'");
    expect(attemptMigration).toContain("attempt_count >= max_attempts THEN 'exhausted'");
    expect(attemptMigration).toContain("status IN ('pending', 'processing', 'retrying')");
  });

  it("stores ordered attempt outcomes and computes metrics from completed HTTP attempts", () => {
    expect(attemptMigration).toContain("CREATE TABLE IF NOT EXISTS public.webhook_delivery_attempts");
    expect(attemptMigration).toContain("UNIQUE (delivery_id, attempt_number)");
    expect(attemptMigration).toContain("a.http_started_at IS NOT NULL");
    expect(attemptMigration).toContain("a.completed_at IS NOT NULL");
    expect(attemptMigration).toContain("a.http_started_at >= NOW() - INTERVAL '24 hours'");
    expect(attemptMigration).toContain("a.http_started_at IS NOT NULL");
    expect(attemptMigration).toContain("complete_webhook_delivery_attempt");
  });

  it("retries transient endpoint and signing-secret database errors but permanently fails missing endpoints", () => {
    expect(webhookWorker).toContain('if (endpointError)');
    expect(webhookWorker).toContain('if (!endpoint || !endpoint.is_active)');
    expect(webhookWorker).toContain("Unable to load endpoint; retry delivery.");
    expect(webhookWorker).toContain('if (secretError)');
    expect(webhookWorker).toContain("Unable to load signing secret; retry delivery.");
    expect(webhookWorker).toContain('if (!secretRecord?.secret)');
    expect(webhookWorker).toContain('status = endpointUnavailable ? "failed" : retryable ? "retrying" : "exhausted";');
  });

  it("loads the selected delivery's attempt rows across its manual-retry chain", () => {
    expect(webhookActions).toContain(".in(\"retry_of\", frontier)");
    expect(webhookActions).toContain(".in(\"delivery_id\", [...relatedDeliveryIds])");
    expect(webhookActions).toContain("safeAttempt(attempt as Record<string, unknown>)");
  });

  it("normalizes status, event, search, and date filters for server-side querying", () => {
    expect(normalizeDeliveryFilters({
      status: "exhausted",
      eventType: "lead.created",
      webhookId: "123e4567-e89b-42d3-a456-426614174000",
      search: "https://hooks.example/a,(b)%_",
      from: "2026-11-01",
      to: "2026-11-02",
    })).toEqual({
      status: "exhausted",
      eventType: "lead.created",
      webhookId: "123e4567-e89b-42d3-a456-426614174000",
      search: "https://hooks.example/a b",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-02T23:59:59.999Z",
    });
    const invalidFilters = normalizeDeliveryFilters({ status: "invalid" as never, eventType: "invalid value", webhookId: "not-an-id" });
    expect(invalidFilters.status).toBe("all");
    expect(invalidFilters.webhookId).toBe("");
  });

  it("fails queued history when an endpoint is deleted instead of leaving it unclaimable", () => {
    expect(webhookMigration).toContain("BEFORE DELETE ON public.webhooks");
    expect(webhookMigration).toContain("Endpoint was deleted before delivery.");
    expect(attemptMigration).toContain("Endpoint was deleted during delivery.");
    expect(attemptMigration).toContain("status IN ('pending', 'processing', 'retrying')");
  });

  it("calculates success only from completed HTTP attempts", () => {
    expect(calculateWebhookStats({
      total_attempts: 4,
      successful_attempts: 3,
      failed_attempts: 1,
      failed_deliveries: 2,
      exhausted_deliveries: 1,
      pending_deliveries: 3,
      avg_duration_ms: 125.6,
      last_24h_attempts: 7,
    })).toEqual({
      totalAttempts: 4,
      successfulAttempts: 3,
      failedAttempts: 1,
      failedDeliveries: 2,
      exhaustedDeliveries: 1,
      pendingDeliveries: 3,
      successRate: 75,
      avgDurationMs: 126,
      last24hAttempts: 7,
    });
    expect(calculateWebhookStats({ total_attempts: 3, successful_attempts: 2 }).successRate).toBe(67);
    expect(calculateWebhookStats({ total_attempts: 0 }).successRate).toBe(0);
  });

  it("applies transient retry classes, a strict attempt ceiling and bounded jitter", () => {
    for (const status of [408, 425, 429, 500, 503]) expect(isRetryableWebhookStatus(status)).toBe(true);
    for (const status of [200, 301, 400, 404]) expect(isRetryableWebhookStatus(status)).toBe(false);
    expect(canRetryWebhook(4, 5)).toBe(true);
    expect(canRetryWebhook(5, 5)).toBe(false);
    expect(webhookRetryDelayMs(1, 0)).toBe(60_000);
    expect(webhookRetryDelayMs(1, 1)).toBe(75_000);
    expect(webhookRetryDelayMs(20, 1)).toBe(3_630_000);
  });
});
