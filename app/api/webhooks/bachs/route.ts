import { NextResponse } from "next/server";
import {
  verifyBachsWebhookEvent,
  getBachsWebhookSecret,
} from "@/lib/payments/bachs";
import { createServiceClient } from "@/utils/supabase/service";
import { activateSubscriptionPlan } from "@/lib/billing/upgrade";
import { logErrorSync } from "@/lib/monitoring/log-error";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { PaymentFailedEmail } from "@/lib/email/templates/payment-failed-email";
import { getConfig } from "@/lib/config/platform-config";
import { revalidatePath } from "next/cache";

async function getAppBaseUrl(): Promise<string> {
  const dbUrl = await getConfig("platform", "app_url");
  const configuredUrl =
    dbUrl ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "https://agentify.app";

  return configuredUrl.trim().replace(/\/+$/, "");
}

export async function POST(request: Request) {
  let eventRecordId: string | null = null;
  const serviceClient = createServiceClient();

  try {
    // 1. Read raw payload & headers
    const rawBody = await request.text();
    const webhookSecret = await getBachsWebhookSecret();

    if (!webhookSecret || webhookSecret.includes("placeholder")) {
      const err = new Error("Bachs Webhook Secret is not configured.");
      logErrorSync(err, "bachs-webhook");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // 2. Cryptographically verify signature using official Bachs SDK
    let event: any;
    try {
      event = verifyBachsWebhookEvent(rawBody, request.headers, webhookSecret);
    } catch (sigErr: any) {
      logErrorSync(sigErr, "bachs-webhook-signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const eventId = event.id;
    const eventType = event.type;
    const eventCreatedAt = event.created_at || new Date().toISOString();

    console.log(`[Bachs Webhook] Received verified event: ${eventType} (id: ${eventId})`);

    // 3. Idempotency Check in webhook_events table
    const { data: existingEvent } = await serviceClient
      .from("webhook_events")
      .select("id, status, processed")
      .eq("provider", "bachs")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      if (existingEvent.status === "processed" || existingEvent.processed === true) {
        console.log(`[Bachs Webhook] Duplicate event ${eventId} already processed. Acknowledging with 200 OK.`);
        return new Response("Event already processed", { status: 200 });
      }
      eventRecordId = existingEvent.id;
    } else {
      const { data: insertedEvent, error: insertErr } = await serviceClient
        .from("webhook_events")
        .insert({
          provider: "bachs",
          event_id: eventId,
          event_type: eventType,
          status: "pending",
          processed: false,
          payload: event,
          received_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!insertErr && insertedEvent) {
        eventRecordId = insertedEvent.id;
      }
    }

    // 4. Handle Webhook Events Authoritatively
    switch (eventType) {
      // ─────────────────────────────────────────────────────────────────
      // A. Payment Collection Succeeded (arrives when payment succeeds)
      // ─────────────────────────────────────────────────────────────────
      case "collection.succeeded":
      case "payment.succeeded":
      case "charge.succeeded": {
        const charge = event.data;
        const checkoutId = charge.checkout_id || null;
        const chargeId = charge.payment_id || charge.charge_id || charge.id || null;
        const subscriptionId = charge.subscription_id || charge.subscription || null;
        const customerId =
          charge.customer_id ||
          charge.customer?.customer_id ||
          charge.customer?.id ||
          (typeof charge.customer === "string" ? charge.customer : null);
        const reference = charge.reference || null;

        // Bachs may send amount in minor units (cents). Normalise to dollars.
        // $10 = 1000 cents. If amount > 100, assume it's in cents.
        const rawAmount = Number(charge.amount) || 0;
        const amount = rawAmount > 100 ? rawAmount / 100 : rawAmount || null;

        // Look up metadata from the pending transaction to get the correct plan.
        // The charge payload often lacks plan/productId — the pending transaction has it.
        let planFromTx: string | null = null;
        let businessIdFromTx: string | null = null;
        let userIdFromTx: string | null = null;
        let productIdFromTx: string | null = null;

        if (checkoutId || reference) {
          const query = serviceClient
            .from("payment_transactions")
            .select("plan, business_id, raw_response")
            .order("created_at", { ascending: false })
            .limit(1);

          if (checkoutId) query.eq("checkout_id", checkoutId);
          else if (reference) query.eq("reference", reference);

          const { data: txRow } = await query.maybeSingle();
          if (txRow) {
            planFromTx = txRow.plan || null;
            businessIdFromTx = txRow.business_id || null;
            const raw = txRow.raw_response as Record<string, any> | null;
            userIdFromTx = raw?.user_id || null;
            productIdFromTx = raw?.product_id || null;
          }
        }

        console.log(`[Bachs Webhook] Processing collection.succeeded for checkout=${checkoutId}, charge=${chargeId}, resolvedPlan=${planFromTx}, amount=$${amount}`);

        const result = await activateSubscriptionPlan({
          businessId: businessIdFromTx,
          userId: userIdFromTx,
          plan: planFromTx,
          productId: productIdFromTx,
          checkoutId,
          chargeId,
          subscriptionId,
          customerId,
          amount,
          reference,
          eventTimestamp: eventCreatedAt,
          sourceEvent: eventType,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to activate subscription upon collection.succeeded");
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────────
      // B. Checkout Completed (arrives when user completes checkout)
      // ─────────────────────────────────────────────────────────────────
      case "checkout.completed":
      case "checkout.session.completed": {
        const checkout = event.data;
        const checkoutId = checkout.checkout_id || checkout.id;
        const status = checkout.status; // e.g. "completed"
        const paymentStatus = checkout.payment_status; // e.g. "paid", "succeeded"
        const metadata = checkout.metadata || {};
        const customerId =
          checkout.customer?.id ||
          checkout.customer?.customer_id ||
          checkout.customer_id ||
          (typeof checkout.customer === "string" ? checkout.customer : null);
        const subscriptionId =
          typeof checkout.subscription === "string"
            ? checkout.subscription
            : (checkout.subscription?.id || checkout.subscription_id || null);
        const productId = checkout.product_cart?.[0]?.product_id || null;
        const amount = Number(checkout.amount) || (metadata.plan === "growth" ? 10.0 : 2.0);
        const reference = checkout.reference || null;

        console.log(`[Bachs Webhook] Processing checkout.completed for checkout=${checkoutId}, paymentStatus=${paymentStatus}`);

        // Only activate plan when payment is confirmed or checkout status is completed
        const isPaid =
          paymentStatus === "paid" ||
          paymentStatus === "succeeded" ||
          status === "completed";

        if (isPaid) {
          const result = await activateSubscriptionPlan({
            businessId: metadata.business_id || null,
            userId: metadata.user_id || null,
            plan: metadata.plan || null,
            productId,
            checkoutId,
            customerId,
            subscriptionId,
            amount,
            reference,
            eventTimestamp: eventCreatedAt,
            sourceEvent: eventType,
          });

          if (!result.success) {
            throw new Error(result.error || "Failed to activate subscription upon checkout.completed");
          }
        } else {
          console.warn(`[Bachs Webhook] Checkout ${checkoutId} completed but paymentStatus is '${paymentStatus}'. Awaiting collection.succeeded.`);
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────────
      // C. Customer Subscription Created / Updated
      // ─────────────────────────────────────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data;
        const subscriptionId = sub.id || sub.subscription_id;
        const customerId =
          sub.customer?.customer_id ||
          sub.customer?.id ||
          sub.customer_id ||
          (typeof sub.customer === "string" ? sub.customer : null);
        const productId = sub.items?.[0]?.product_id || sub.product_id || null;
        const metadata = sub.metadata || {};
        const amount = Number(sub.amount || sub.items?.[0]?.unit_amount) || null;
        const periodStart = sub.current_period_start || null;
        const periodEnd = sub.current_period_end || null;

        console.log(`[Bachs Webhook] Processing ${eventType} for sub=${subscriptionId}, customer=${customerId}`);

        if (sub.status === "active" || sub.status === "trialing") {
          const result = await activateSubscriptionPlan({
            businessId: metadata.business_id || null,
            userId: metadata.user_id || null,
            plan: metadata.plan || null,
            productId,
            customerId,
            subscriptionId,
            amount,
            periodStart,
            periodEnd,
            eventTimestamp: eventCreatedAt,
            sourceEvent: eventType,
          });

          if (!result.success) {
            throw new Error(result.error || `Failed to activate subscription upon ${eventType}`);
          }
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────────
      // D. Invoice Paid / Payment Succeeded (Renewal & Period Extension)
      // ─────────────────────────────────────────────────────────────────
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data;
        const invoiceId = invoice.invoice_id || invoice.id;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : (invoice.subscription?.id || invoice.subscription_id || null);
        const customerId =
          invoice.customer?.id ||
          invoice.customer?.customer_id ||
          invoice.customer_id ||
          (typeof invoice.customer === "string" ? invoice.customer : null);
        const amount = Number(invoice.total || invoice.amount_paid || 0);
        const chargeId = invoice.charge?.charge_id || invoice.charge_id || invoice.payment_id || null;
        const periodStart = invoice.period_start || null;
        const periodEnd = invoice.period_end || null;

        console.log(`[Bachs Webhook] Processing invoice.paid for invoice=${invoiceId}, sub=${subscriptionId}`);

        const result = await activateSubscriptionPlan({
          subscriptionId,
          customerId,
          invoiceId,
          chargeId,
          amount,
          periodStart,
          periodEnd,
          eventTimestamp: eventCreatedAt,
          sourceEvent: eventType,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to update subscription upon invoice.paid");
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────────
      // E. Subscription Deleted / Canceled
      // ─────────────────────────────────────────────────────────────────
      case "customer.subscription.deleted":
      case "subscription.canceled": {
        const sub = event.data;
        const subscriptionId = sub.id || sub.subscription_id;
        const customerId =
          sub.customer?.customer_id ||
          sub.customer?.id ||
          sub.customer_id ||
          (typeof sub.customer === "string" ? sub.customer : null);

        console.log(`[Bachs Webhook] Processing subscription cancellation for sub=${subscriptionId}`);

        const { data: existingSub } = await serviceClient
          .from("subscriptions")
          .select("id")
          .or(`bachs_subscription_id.eq.${subscriptionId},provider_subscription_id.eq.${subscriptionId},bachs_customer_id.eq.${customerId}`)
          .maybeSingle();

        if (existingSub) {
          await serviceClient
            .from("subscriptions")
            .update({
              status: "canceled",
              cancel_at_period_end: false,
              canceled_at: sub.canceled_at || eventCreatedAt,
              updated_at: eventCreatedAt,
            })
            .eq("id", existingSub.id);

          try {
            revalidatePath("/dashboard", "layout");
            revalidatePath("/dashboard/billing");
          } catch (e) {
            console.warn("[Bachs Webhook] Revalidate path warning:", e);
          }
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────────
      // F. Payment or Collection Failed
      // ─────────────────────────────────────────────────────────────────
      case "collection.failed":
      case "payment.failed":
      case "invoice.payment_failed": {
        const charge = event.data;
        const checkoutId = charge.checkout_id || null;
        const invoiceId = charge.invoice_id || charge.id || null;
        const subscriptionId =
          charge.subscription_id ||
          (typeof charge.subscription === "string" ? charge.subscription : charge.subscription?.id) ||
          null;
        const customerId =
          charge.customer_id ||
          charge.customer?.id ||
          (typeof charge.customer === "string" ? charge.customer : null);

        console.warn(`[Bachs Webhook] Payment failed for checkout=${checkoutId}, sub=${subscriptionId}`);

        if (checkoutId) {
          await serviceClient
            .from("payment_transactions")
            .update({
              status: "failed",
              charge_id: charge.charge_id || charge.payment_id || null,
            })
            .eq("checkout_id", checkoutId);
        }

        const { data: sub } = await serviceClient
          .from("subscriptions")
          .select("id, business_id, plan")
          .or(`bachs_subscription_id.eq.${subscriptionId},provider_subscription_id.eq.${subscriptionId},bachs_customer_id.eq.${customerId}`)
          .maybeSingle();

        if (sub) {
          await serviceClient
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: eventCreatedAt,
            })
            .eq("id", sub.id);

          const { data: business } = await serviceClient
            .from("businesses")
            .select("name, contact_email")
            .eq("id", sub.business_id)
            .maybeSingle();

          if (business?.contact_email) {
            const appUrl = await getAppBaseUrl();
            await sendTransactionalEmail({
              businessId: sub.business_id,
              to: business.contact_email,
              subject: "Payment failed — update your billing method",
              templateName: "payment-failed-email",
              react: PaymentFailedEmail({
                businessName: business.name || "there",
                plan: (sub.plan || "Starter").charAt(0).toUpperCase() + (sub.plan || "starter").slice(1),
                billingUrl: `${appUrl}/dashboard/billing`,
              }),
            });
          }
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────────
      // G. Checkout Expired / Abandoned
      // ─────────────────────────────────────────────────────────────────
      case "checkout.expired": {
        const checkout = event.data;
        const checkoutId = checkout.checkout_id || checkout.id;

        if (checkoutId) {
          await serviceClient
            .from("payment_transactions")
            .update({
              status: "abandoned",
            })
            .eq("checkout_id", checkoutId)
            .eq("status", "pending");
        }
        break;
      }

      default:
        console.log(`[Bachs Webhook] Acknowledged unhandled event type: ${eventType}`);
        break;
    }

    // 5. Mark webhook event as successfully processed
    if (eventRecordId) {
      await serviceClient
        .from("webhook_events")
        .update({
          status: "processed",
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventRecordId);
    }

    return new Response(JSON.stringify({ received: true, status: "processed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logErrorSync(error, "bachs-webhook-handler");

    if (eventRecordId) {
      await serviceClient
        .from("webhook_events")
        .update({
          status: "failed",
          error_details: error.message || "Unknown error during webhook processing",
        })
        .eq("id", eventRecordId);
    }

    // Return HTTP 500 so Bachs retries transient errors
    return new Response(JSON.stringify({ error: error.message || "Webhook processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
