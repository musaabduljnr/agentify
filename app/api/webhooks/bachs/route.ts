import { z } from "zod";
import { activateSubscriptionPlan } from "@/lib/billing/upgrade";
import { getBachsWebhookSecret, verifyBachsWebhookEvent } from "@/lib/payments/bachs";
import { logErrorSync } from "@/lib/monitoring/log-error";
import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";

const eventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  created_at: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

type BachsEvent = z.infer<typeof eventSchema>;
type ServiceClient = ReturnType<typeof createServiceClient>;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nestedId(value: unknown): string | null {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return stringValue(record.subscription_id) || stringValue(record.customer_id) || stringValue(record.id);
}

function eventDate(event: BachsEvent): string {
  const date = event.created_at ? new Date(event.created_at) : new Date();
  if (!Number.isFinite(date.getTime())) throw new Error("Bachs event has an invalid created_at value.");
  return date.toISOString();
}

async function acknowledgeEvent(
  supabase: ServiceClient,
  eventRowId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("webhook_events")
    .update({
      status: "processed",
      processed: true,
      processed_at: new Date().toISOString(),
      processing_started_at: null,
      error_details: null,
    })
    .eq("id", eventRowId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to acknowledge Bachs webhook event: ${error.message}`);
  if (!data) throw new Error("Bachs webhook event disappeared before it could be acknowledged.");
}

async function findTransaction(
  supabase: ServiceClient,
  checkoutId: string | null,
  reference: string | null
) {
  if (checkoutId) {
    const { data, error } = await supabase
      .from("payment_transactions")
      .select("id, reference")
      .eq("provider", "bachs")
      .eq("checkout_id", checkoutId)
      .maybeSingle();
    if (error) throw new Error(`Failed to find checkout transaction: ${error.message}`);
    if (!data || (reference && data.reference !== reference)) return null;
    return data;
  }

  if (reference) {
    const { data, error } = await supabase
      .from("payment_transactions")
      .select("id, reference")
      .eq("provider", "bachs")
      .eq("reference", reference)
      .maybeSingle();
    if (error) throw new Error(`Failed to find payment reference: ${error.message}`);
    if (data) return data;
  }

  return null;
}

function isAgentifyCheckout(metadata: Record<string, unknown>): boolean {
  return (
    typeof metadata.business_id === "string" ||
    metadata.plan === "starter" ||
    metadata.plan === "growth"
  );
}

async function claimEvent(
  supabase: ServiceClient,
  event: BachsEvent
): Promise<{ id: string; alreadyProcessed: boolean } | null> {
  const inserted = await supabase.from("webhook_events").insert({
    provider: "bachs",
    event_id: event.id,
    event_type: event.type,
    status: "pending",
    processed: false,
    payload: event,
    received_at: new Date().toISOString(),
  });

  if (inserted.error && inserted.error.code !== "23505") {
    throw new Error(`Failed to persist Bachs webhook event: ${inserted.error.message}`);
  }

  const { data: existing, error: lookupError } = await supabase
    .from("webhook_events")
    .select("id, status, processed, processing_started_at")
    .eq("provider", "bachs")
    .eq("event_id", event.id)
    .maybeSingle();

  if (lookupError) throw new Error(`Failed to read Bachs webhook event: ${lookupError.message}`);
  if (!existing) throw new Error("Bachs webhook event was not durably stored.");
  if (existing.status === "processed" || existing.processed) {
    return { id: existing.id, alreadyProcessed: true };
  }

  const now = new Date();
  const startedAt = existing.processing_started_at
    ? new Date(existing.processing_started_at)
    : null;
  const mayRecoverStaleClaim =
    existing.status === "processing" &&
    (!startedAt || now.getTime() - startedAt.getTime() >= 5 * 60 * 1000);

  if (!["pending", "failed"].includes(existing.status) && !mayRecoverStaleClaim) {
    return null;
  }

  let claimQuery = supabase
    .from("webhook_events")
    .update({
      status: "processing",
      processing_started_at: now.toISOString(),
      error_details: null,
    })
    .eq("id", existing.id);

  if (mayRecoverStaleClaim) {
    claimQuery = claimQuery.eq("status", "processing");
    claimQuery = startedAt
      ? claimQuery.eq("processing_started_at", existing.processing_started_at)
      : claimQuery.is("processing_started_at", null);
  } else {
    claimQuery = claimQuery.eq("status", existing.status);
  }

  const { data: claimed, error: claimError } = await claimQuery
    .select("id")
    .maybeSingle();

  if (claimError) throw new Error(`Failed to claim Bachs webhook event: ${claimError.message}`);
  if (claimed) return { id: claimed.id, alreadyProcessed: false };

  const { data: latest, error: latestError } = await supabase
    .from("webhook_events")
    .select("id, status, processed")
    .eq("provider", "bachs")
    .eq("event_id", event.id)
    .maybeSingle();

  if (latestError) throw new Error(`Failed to confirm Bachs webhook state: ${latestError.message}`);
  if (latest?.status === "processed" || latest?.processed) {
    return { id: existing.id, alreadyProcessed: true };
  }

  return null;
}

export async function POST(request: Request) {
  let supabase: ServiceClient | null = null;
  let eventRowId: string | null = null;

  try {
    const rawBody = await request.text();
    const webhookSecret = await getBachsWebhookSecret();
    if (!webhookSecret || webhookSecret.includes("placeholder")) {
      throw new Error("Bachs webhook secret is not configured.");
    }

    let verifiedEvent: unknown;
    try {
      verifiedEvent = verifyBachsWebhookEvent(
        rawBody,
        Object.fromEntries(request.headers.entries()),
        webhookSecret
      );
    } catch (error) {
      logErrorSync(error, "bachs-webhook-signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const parsedEvent = eventSchema.safeParse(verifiedEvent);
    if (!parsedEvent.success) {
      return new Response("Invalid Bachs event payload", { status: 400 });
    }

    const event = parsedEvent.data;
    const createdAt = eventDate(event);
    supabase = createServiceClient();

    const claim = await claimEvent(supabase, event);
    if (!claim) {
      return new Response("Event is already being processed; retry later.", { status: 503 });
    }
    eventRowId = claim.id;
    if (claim.alreadyProcessed) {
      return new Response("Event already processed", { status: 200 });
    }

    const data = event.data;
    const metadata = asRecord(data.metadata);
    const customerId = nestedId(data.customer);
    const subscriptionId = nestedId(data.subscription);
    const checkoutId = stringValue(data.checkout_id);
    const reference = stringValue(data.reference);

    switch (event.type) {
      case "collection.succeeded": {
        if (data.status !== "SUCCEEDED") {
          const transaction = await findTransaction(supabase, checkoutId, reference);
          if (!transaction) throw new Error("Bachs collection has no matching checkout transaction.");

          const { error } = await supabase
            .from("payment_transactions")
            .update({
              failure_reason: `Bachs collection state requires review: ${String(data.status)}`,
            })
            .eq("id", transaction.id);
          if (error) throw new Error(`Failed to record Bachs collection state: ${error.message}`);
          await acknowledgeEvent(supabase, eventRowId);
          return new Response("Collection requires review; subscription was not activated.", {
            status: 200,
          });
        }

        const product = asRecord(Array.isArray(data.product_cart) ? data.product_cart[0] : null);
        const result = await activateSubscriptionPlan({
          eventId: event.id,
          eventTimestamp: createdAt,
          checkoutId,
          reference,
          productId: stringValue(product.product_id) || stringValue(metadata.product_id),
          customerId,
          subscriptionId,
          chargeId: stringValue(data.charge_id),
          amount: stringValue(data.amount) || "",
          currency: stringValue(data.currency) || "",
          metadata,
          sourceEvent: "collection.succeeded",
        });
        console.info("[Bachs Webhook] Collection applied", {
          eventId: event.id,
          businessId: result.businessId,
          plan: result.plan,
        });
        break;
      }

      case "checkout.completed": {
        if (data.status !== "completed") {
          throw new Error(`Unexpected Bachs checkout status: ${String(data.status)}`);
        }

        if (data.payment_status !== "paid") {
          const transaction = await findTransaction(supabase, checkoutId, reference);
          if (!transaction && isAgentifyCheckout(metadata)) {
            throw new Error("Bachs checkout event has no matching Agentify transaction.");
          }

          if (data.payment_status === "no_payment_required" && transaction) {
            const { error } = await supabase
              .from("payment_transactions")
              .update({
                status: "failed",
                failure_reason: "Bachs completed this checkout without collecting payment.",
              })
              .eq("id", transaction.id)
              .in("status", ["pending", "abandoned"]);
            if (error) throw new Error(`Failed to record unpaid Bachs checkout: ${error.message}`);
          }

          await acknowledgeEvent(supabase, eventRowId);
          return new Response("Checkout completed without a collected payment.", { status: 200 });
        }

        const checkoutSubscription = asRecord(data.subscription);
        const result = await activateSubscriptionPlan({
          eventId: event.id,
          eventTimestamp: createdAt,
          checkoutId,
          reference,
          productId: stringValue(metadata.product_id),
          customerId,
          subscriptionId:
            stringValue(checkoutSubscription.subscription_id) || subscriptionId,
          chargeId: stringValue(asRecord(data.charge).id),
          amount: stringValue(data.amount) || "",
          currency: stringValue(data.currency) || "",
          metadata,
          sourceEvent: "checkout.completed",
        });
        console.info("[Bachs Webhook] Paid checkout applied", {
          eventId: event.id,
          businessId: result.businessId,
          plan: result.plan,
        });
        break;
      }

      case "invoice.paid": {
        if (data.status !== "paid") throw new Error("Bachs invoice.paid event is not marked paid.");
        const invoiceSubscriptionId = nestedId(data.subscription);
        const invoiceId = stringValue(data.invoice_id);
        const amount = stringValue(data.amount_paid);
        const currency = stringValue(data.currency);
        if (!invoiceSubscriptionId || !invoiceId || !amount || !currency) {
          throw new Error("Bachs paid invoice is missing required billing identifiers.");
        }

        const { error } = await supabase.rpc("apply_bachs_invoice_paid_event", {
          p_event_id: event.id,
          p_subscription_id: invoiceSubscriptionId,
          p_invoice_id: invoiceId,
          p_charge_id: stringValue(asRecord(data.charge).id),
          p_amount: Number(amount),
          p_currency: currency,
          p_period_start: stringValue(data.period_start),
          p_period_end: stringValue(data.period_end),
          p_event_created_at: createdAt,
        });
        if (error) throw new Error(`Failed to apply paid Bachs invoice: ${error.message}`);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const statusData =
          event.type === "invoice.payment_failed"
            ? {
                status: "past_due",
                subscription_id: nestedId(data.subscription),
                period_start: data.period_start,
                period_end: data.period_end,
              }
            : {
                status: data.status,
                subscription_id: data.subscription_id,
                period_start: data.current_period_start,
                period_end: data.current_period_end,
                cancel_at_period_end: data.cancel_at_period_end,
                canceled_at: data.canceled_at,
              };

        const statusSubscriptionId = stringValue(statusData.subscription_id);
        const providerStatus = stringValue(statusData.status);
        if (!statusSubscriptionId || !providerStatus) {
          throw new Error("Bachs subscription event is missing its subscription ID or status.");
        }

        const { error } = await supabase.rpc("apply_bachs_subscription_status_event", {
          p_event_id: event.id,
          p_subscription_id: statusSubscriptionId,
          p_provider_status: providerStatus,
          p_period_start: stringValue(statusData.period_start),
          p_period_end: stringValue(statusData.period_end),
          p_cancel_at_period_end:
            typeof statusData.cancel_at_period_end === "boolean"
              ? statusData.cancel_at_period_end
              : null,
          p_canceled_at: stringValue(statusData.canceled_at),
          p_event_created_at: createdAt,
        });
        if (error) throw new Error(`Failed to apply Bachs subscription status: ${error.message}`);
        break;
      }

      case "collection.failed": {
        const transaction = await findTransaction(supabase, checkoutId, reference);
        if (!transaction && isAgentifyCheckout(metadata)) {
          throw new Error("Bachs collection failure has no matching Agentify transaction.");
        }
        if (transaction) {
          const { error } = await supabase
            .from("payment_transactions")
            .update({ failure_reason: stringValue(data.reason) || "Payment attempt failed." })
            .eq("id", transaction.id);
          if (error) throw new Error(`Failed to record Bachs payment failure: ${error.message}`);
        }
        await acknowledgeEvent(supabase, eventRowId);
        return new Response("Payment attempt recorded; checkout remains available for retry.", {
          status: 200,
        });
      }

      case "checkout.expired": {
        const transaction = await findTransaction(supabase, checkoutId, reference);
        if (!transaction && isAgentifyCheckout(metadata)) {
          throw new Error("Bachs expired checkout has no matching Agentify transaction.");
        }
        if (transaction) {
          const { error } = await supabase
            .from("payment_transactions")
            .update({
              status: "abandoned",
              failure_reason: "Checkout expired. A late successful collection may still complete.",
            })
            .eq("id", transaction.id)
            .eq("status", "pending");
          if (error) throw new Error(`Failed to record expired Bachs checkout: ${error.message}`);
        }
        await acknowledgeEvent(supabase, eventRowId);
        return new Response("Expired checkout recorded.", { status: 200 });
      }

      default:
        console.info("[Bachs Webhook] Acknowledging unsupported event", {
          eventId: event.id,
          eventType: event.type,
        });
        await acknowledgeEvent(supabase, eventRowId);
        return new Response("Event acknowledged.", { status: 200 });
    }

    try {
      revalidatePath("/dashboard", "layout");
      revalidatePath("/dashboard/billing");
    } catch (error) {
      logErrorSync(error, "bachs-webhook-cache-revalidation");
    }

    return new Response(JSON.stringify({ received: true, status: "processed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logErrorSync(error, "bachs-webhook-handler");

    if (supabase && eventRowId) {
      const { error: updateError } = await supabase
        .from("webhook_events")
        .update({
          status: "failed",
          processed: false,
          processing_started_at: null,
          error_details: error instanceof Error ? error.message : "Unknown webhook processing error.",
        })
        .eq("id", eventRowId);

      if (updateError) {
        logErrorSync(updateError, "bachs-webhook-failure-record");
      }
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Webhook processing failed.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
