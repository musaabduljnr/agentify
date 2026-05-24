import { NextResponse } from "next/server";
import {
  parsePaystackWebhook,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "@/lib/payments/paystack";
import { createServiceClient } from "@/utils/supabase/service";
import { type PlanId } from "@/lib/billing/plans";
import { getEffectivePlanLimits } from "@/lib/billing/platform";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value || 0);
}

export async function POST(request: Request) {
  let webhookEventRowId: string | null = null;

  try {
    // 1. Get raw body and signature header
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature") || "";

    if (!signature) {
      console.error("[Paystack Webhook] Missing x-paystack-signature header.");
      return new Response("Missing signature header.", { status: 400 });
    }

    // 2. Verify HMAC SHA512 Signature
    const isValid = verifyPaystackWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.error("[Paystack Webhook] Signature verification failed!");
      return new Response("Unauthorized signature mismatch.", { status: 401 });
    }

    // 3. Parse webhook payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    }
    const { event, data } = parsePaystackWebhook(payload);
    console.log(`[Paystack Webhook Received] Event: ${event}`);

    const supabase = createServiceClient();
    const reference =
      typeof data.reference === "string" ? data.reference : undefined;
    const subscription = asRecord(data.subscription);
    const subscriptionCode =
      typeof data.subscription_code === "string"
        ? data.subscription_code
        : stringValue(subscription.subscription_code || data.subscription);
    const payloadRecord = asRecord(payload);
    const eventId = String(
      payloadRecord.id ||
        data.id ||
        `${event}:${reference || subscriptionCode || rawBody.length}`
    );

    const { data: webhookEvent, error: webhookEventError } = await supabase
      .from("webhook_events")
      .insert({
        provider: "paystack",
        event_id: eventId,
        event_type: event,
        reference: reference || null,
        payload: payloadRecord,
      })
      .select("id")
      .single();

    if (webhookEventError) {
      if (webhookEventError.code === "23505") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw webhookEventError;
    }

    webhookEventRowId = webhookEvent.id;

    const markWebhookProcessed = async () => {
      await supabase
        .from("webhook_events")
        .update({ processed: true })
        .eq("id", webhookEvent.id);
    };

    // 4. Handle events
    if (event === "charge.success") {
      if (!reference) {
        await markWebhookProcessed();
        return NextResponse.json({ error: "Missing reference" }, { status: 400 });
      }

      const { data: tx, error: txError } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      if (txError || !tx) {
        await markWebhookProcessed();
        return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
      }

      // Idempotency: skip if already verified as success
      if (tx.status === "success") {
        console.log(`[Paystack Webhook] Reference ${reference} already marked success. Skipping.`);
        await markWebhookProcessed();
        return NextResponse.json({ received: true });
      }

      const verified = await verifyPaystackTransaction(reference);
      if (
        verified.status !== "success" ||
        verified.reference !== reference ||
        numberValue(verified.amount) !== Number(tx.amount) * 100
      ) {
        await supabase
          .from("payment_transactions")
          .update({
            status: "failed",
            raw_response: {
              ...asRecord(tx.raw_response),
              webhook: payload,
              webhook_verification: verified,
            },
          })
          .eq("id", tx.id);

        await markWebhookProcessed();
        return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
      }

      const planId = tx.plan as PlanId;
      const verifiedCustomer = asRecord(verified.customer);
      const dataCustomer = asRecord(data.customer);
      const customerCode = stringValue(verifiedCustomer.customer_code || dataCustomer.customer_code);
      const verifiedSubscriptionCode = stringValue(verified.subscription || data.subscription);
      const planCode = stringValue(verified.plan || data.plan);
      const resolvedBusinessId = tx.business_id;
      const planLimits = await getEffectivePlanLimits(planId);
      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);

      await supabase
        .from("payment_transactions")
        .update({
          status: "success",
          verified_at: now.toISOString(),
          provider_customer_id: customerCode || null,
          provider_subscription_id: verifiedSubscriptionCode || null,
          raw_response: {
            ...asRecord(tx.raw_response),
            webhook: payload,
            webhook_verification: verified,
          },
        })
        .eq("id", tx.id);

      // Upgrade subscription records
      await supabase
        .from("subscriptions")
        .update({
          plan: planId,
          status: "active",
          payment_provider: "paystack",
          provider_customer_id: customerCode || null,
          provider_subscription_id: verifiedSubscriptionCode || null,
          provider_plan_code: planCode || null,
          provider_reference: reference,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          reset_date: periodEnd.toISOString(),
          cancel_at_period_end: false,
          ...planLimits,
          updated_at: now.toISOString(),
        })
        .eq("business_id", resolvedBusinessId);

      console.log(
        `[Paystack Webhook Success] Activated plan '${planId}' for business: ${resolvedBusinessId}`
      );
    } 
    
    else if (event === "subscription.create") {
      const subscriptionCode = stringValue(data.subscription_code);
      const customerCode = stringValue(asRecord(data.customer).customer_code);
      const planCode = stringValue(asRecord(data.plan).plan_code);

      if (subscriptionCode && customerCode) {
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            provider_subscription_id: subscriptionCode,
            provider_plan_code: planCode || null,
            updated_at: new Date().toISOString(),
          })
          .eq("provider_customer_id", customerCode);
        console.log(
          `[Paystack Webhook] Subscription created / updated active for customer: ${customerCode}`
        );
      }
    } 
    
    else if (event === "subscription.disable") {
      const subscriptionCode = stringValue(data.subscription_code);
      if (subscriptionCode) {
        await supabase
          .from("subscriptions")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("provider_subscription_id", subscriptionCode);
        console.log(`[Paystack Webhook] Subscription disabled for code: ${subscriptionCode}`);
      }
    } 
    
    else if (event === "invoice.payment_failed") {
      const subscriptionCode = stringValue(asRecord(data.subscription).subscription_code);
      if (subscriptionCode) {
        await supabase
          .from("subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("provider_subscription_id", subscriptionCode);
        console.log(`[Paystack Webhook] Payment failed. Set past_due on: ${subscriptionCode}`);
      }
    } 
    
    else if (event === "invoice.update") {
      const subscriptionCode = stringValue(asRecord(data.subscription).subscription_code);
      const isPaid = data.paid === true;

      if (subscriptionCode && isPaid) {
        const now = new Date();
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + 30);

        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            reset_date: periodEnd.toISOString(),
            current_usage: 0,
            updated_at: now.toISOString(),
          })
          .eq("provider_subscription_id", subscriptionCode);
        console.log(`[Paystack Webhook] Invoice paid. Rollover completed for: ${subscriptionCode}`);
      }
    }

    await markWebhookProcessed();

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    logErrorSync(error, "paystack-webhook", {
      metadata: { webhookEventRowId },
    });
    return NextResponse.json(
      { error: getUserFriendlyError("paystack-webhook") },
      { status: 500 }
    );
  }
}
