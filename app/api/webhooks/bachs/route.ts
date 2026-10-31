import { NextResponse } from "next/server";
import {
  verifyBachsWebhookEvent,
  getBachsWebhookSecret,
  BachsWebhookError,
} from "@/lib/payments/bachs";
import { createServiceClient } from "@/utils/supabase/service";
import { type PlanId } from "@/lib/billing/plans";
import { getEffectivePlanLimits } from "@/lib/billing/platform";
import { logErrorSync } from "@/lib/monitoring/log-error";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { PaymentSuccessEmail } from "@/lib/email/templates/payment-success-email";
import { PaymentFailedEmail } from "@/lib/email/templates/payment-failed-email";
import { getConfig } from "@/lib/config/platform-config";

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
    // 1. Get raw request body and headers
    const rawBody = await request.text();
    const webhookSecret = await getBachsWebhookSecret();

    if (!webhookSecret || webhookSecret.includes("placeholder")) {
      logErrorSync(new Error("Bachs Webhook Secret is not configured."), "bachs-webhook");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // 2. Verify signature using official Bachs constructEvent
    let event: any;
    try {
      event = verifyBachsWebhookEvent(rawBody, request.headers, webhookSecret);
    } catch (err: any) {
      logErrorSync(err, "bachs-webhook-signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const eventId = event.id;
    const eventType = event.type;
    const eventCreatedAt = event.created_at || new Date().toISOString();

    // 3. Idempotency Check in webhook_events table
    const { data: existingEvent } = await serviceClient
      .from("webhook_events")
      .select("id, status")
      .eq("provider", "bachs")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      if (existingEvent.status === "processed") {
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
          payload: event,
          received_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!insertErr && insertedEvent) {
        eventRecordId = insertedEvent.id;
      }
    }

    // 4. Handle Event by Type
    switch (eventType) {
      case "customer.subscription.created": {
        const sub = event.data;
        const customerId = sub.customer?.customer_id;
        const subscriptionId = sub.subscription_id;
        const productId = sub.product_id;
        const planKey = (sub.metadata?.plan || (productId === process.env.BACHS_GROWTH_PRODUCT_ID ? "growth" : "starter")) as PlanId;
        const businessId = sub.metadata?.business_id;

        // Resolve business
        let targetBusinessId = businessId;
        if (!targetBusinessId && customerId) {
          const { data: existingSub } = await serviceClient
            .from("subscriptions")
            .select("business_id")
            .or(`bachs_customer_id.eq.${customerId},provider_customer_id.eq.${customerId}`)
            .maybeSingle();
          targetBusinessId = existingSub?.business_id;
        }

        if (!targetBusinessId && sub.customer?.email) {
          const { data: bus } = await serviceClient
            .from("businesses")
            .select("id")
            .eq("contact_email", sub.customer.email)
            .maybeSingle();
          targetBusinessId = bus?.id;
        }

        if (targetBusinessId) {
          // Out-of-order event check
          const { data: curSub } = await serviceClient
            .from("subscriptions")
            .select("updated_at")
            .eq("business_id", targetBusinessId)
            .maybeSingle();

          if (curSub && curSub.updated_at && Date.parse(curSub.updated_at) > Date.parse(eventCreatedAt)) {
            // Newer state already recorded
            break;
          }

          const planLimits = await getEffectivePlanLimits(planKey);

          await serviceClient
            .from("subscriptions")
            .update({
              plan: planKey,
              status: sub.status === "active" ? "active" : sub.status,
              payment_provider: "bachs",
              provider: "bachs",
              bachs_customer_id: customerId || null,
              provider_customer_id: customerId || null,
              bachs_subscription_id: subscriptionId || null,
              provider_subscription_id: subscriptionId || null,
              bachs_product_id: productId || null,
              billing_currency: "USD",
              billing_amount: Number(sub.amount) || (planKey === "starter" ? 2.0 : 10.0),
              current_period_start: sub.current_period_start,
              current_period_end: sub.current_period_end,
              reset_date: sub.current_period_end,
              cancel_at_period_end: sub.cancel_at_period_end || false,
              canceled_at: sub.canceled_at || null,
              ...planLimits,
              updated_at: eventCreatedAt,
            })
            .eq("business_id", targetBusinessId);

          // Correlate and mark pending transaction if matching checkout exists
          if (sub.metadata?.business_id) {
            await serviceClient
              .from("payment_transactions")
              .update({
                status: "success",
                provider_customer_id: customerId,
                provider_subscription_id: subscriptionId,
                verified_at: eventCreatedAt,
              })
              .eq("business_id", targetBusinessId)
              .eq("provider", "bachs")
              .eq("status", "pending");
          }

          // Send payment confirmation email
          const { data: business } = await serviceClient
            .from("businesses")
            .select("name, contact_email")
            .eq("id", targetBusinessId)
            .single();

          const toEmail = sub.customer?.email || business?.contact_email;
          if (toEmail) {
            await sendTransactionalEmail({
              businessId: targetBusinessId,
              to: toEmail,
              subject: "Your Agentify subscription is active",
              templateName: "payment-success-email",
              react: PaymentSuccessEmail({
                businessName: business?.name || "there",
                plan: planKey.charAt(0).toUpperCase() + planKey.slice(1),
                amount: `$${Number(sub.amount || (planKey === "starter" ? 2 : 10)).toFixed(2)} USD`,
                billingUrl: `${await getAppBaseUrl()}/dashboard/billing`,
              }),
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data;
        const subscriptionId = sub.subscription_id;
        const customerId = sub.customer?.customer_id;

        const { data: existingSub } = await serviceClient
          .from("subscriptions")
          .select("id, business_id, updated_at, plan")
          .or(`bachs_subscription_id.eq.${subscriptionId},provider_subscription_id.eq.${subscriptionId},bachs_customer_id.eq.${customerId}`)
          .maybeSingle();

        if (existingSub) {
          if (existingSub.updated_at && Date.parse(existingSub.updated_at) > Date.parse(eventCreatedAt)) {
            break; // Skip older out-of-order event
          }

          const targetPlan = (sub.metadata?.plan || (sub.product_id === process.env.BACHS_GROWTH_PRODUCT_ID ? "growth" : existingSub.plan || "starter")) as PlanId;
          const planLimits = await getEffectivePlanLimits(targetPlan);

          await serviceClient
            .from("subscriptions")
            .update({
              plan: targetPlan,
              status: sub.status,
              current_period_start: sub.current_period_start,
              current_period_end: sub.current_period_end,
              reset_date: sub.current_period_end,
              cancel_at_period_end: sub.cancel_at_period_end || false,
              canceled_at: sub.canceled_at || null,
              billing_amount: Number(sub.amount) || 0,
              billing_currency: "USD",
              ...planLimits,
              updated_at: eventCreatedAt,
            })
            .eq("id", existingSub.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data;
        const subscriptionId = sub.subscription_id;
        const customerId = sub.customer?.customer_id;

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
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data;
        const subscriptionId = invoice.subscription?.subscription_id;
        const customerId = invoice.customer?.customer_id;
        const amountDecimal = invoice.total || invoice.amount_paid || "0.00";

        // Find business
        const { data: sub } = await serviceClient
          .from("subscriptions")
          .select("id, business_id, plan")
          .or(`bachs_subscription_id.eq.${subscriptionId},provider_subscription_id.eq.${subscriptionId},bachs_customer_id.eq.${customerId}`)
          .maybeSingle();

        if (sub) {
          // Record invoice payment transaction
          await serviceClient
            .from("payment_transactions")
            .insert({
              business_id: sub.business_id,
              subscription_id: sub.id,
              provider: "bachs",
              reference: invoice.invoice_id,
              invoice_id: invoice.invoice_id,
              charge_id: invoice.charge?.charge_id || null,
              plan: sub.plan || "starter",
              amount: Number(amountDecimal) || 0,
              currency: "USD",
              status: "success",
              verified_at: eventCreatedAt,
              raw_response: invoice,
            });

          // Ensure subscription is active and period is extended
          await serviceClient
            .from("subscriptions")
            .update({
              status: "active",
              current_period_start: invoice.period_start,
              current_period_end: invoice.period_end,
              reset_date: invoice.period_end,
              updated_at: eventCreatedAt,
            })
            .eq("id", sub.id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data;
        const subscriptionId = invoice.subscription?.subscription_id;
        const customerId = invoice.customer?.customer_id;

        const { data: sub } = await serviceClient
          .from("subscriptions")
          .select("id, business_id, plan")
          .or(`bachs_subscription_id.eq.${subscriptionId},provider_subscription_id.eq.${subscriptionId},bachs_customer_id.eq.${customerId}`)
          .maybeSingle();

        if (sub) {
          // Record failed payment
          await serviceClient
            .from("payment_transactions")
            .insert({
              business_id: sub.business_id,
              subscription_id: sub.id,
              provider: "bachs",
              reference: `fail_${invoice.invoice_id}_${Date.now()}`,
              invoice_id: invoice.invoice_id,
              plan: sub.plan || "starter",
              amount: Number(invoice.total || 0),
              currency: "USD",
              status: "failed",
              raw_response: invoice,
            });

          // Mark subscription past_due
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
            .single();

          const toEmail = invoice.customer?.email || business?.contact_email;
          if (toEmail) {
            await sendTransactionalEmail({
              businessId: sub.business_id,
              to: toEmail,
              subject: "Payment failed — update your payment method",
              templateName: "payment-failed-email",
              react: PaymentFailedEmail({
                businessName: business?.name || "there",
                plan: (sub.plan || "Starter").charAt(0).toUpperCase() + (sub.plan || "starter").slice(1),
                billingUrl: `${await getAppBaseUrl()}/dashboard/billing`,
              }),
            });
          }
        }
        break;
      }

      case "collection.succeeded": {
        const charge = event.data;
        const checkoutId = charge.checkout_id;
        const chargeId = charge.charge_id;

        if (checkoutId) {
          await serviceClient
            .from("payment_transactions")
            .update({
              status: "success",
              charge_id: chargeId || null,
              verified_at: eventCreatedAt,
            })
            .eq("checkout_id", checkoutId);
        }
        break;
      }

      case "collection.failed": {
        const charge = event.data;
        const checkoutId = charge.checkout_id;

        if (checkoutId) {
          await serviceClient
            .from("payment_transactions")
            .update({
              status: "failed",
              charge_id: charge.charge_id || null,
            })
            .eq("checkout_id", checkoutId);
        }
        break;
      }

      case "checkout.expired": {
        const checkout = event.data;
        const checkoutId = checkout.checkout_id;

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

      case "checkout.completed": {
        // Audit log and correlate customer ID if newly created
        const checkout = event.data;
        const customerId = checkout.customer?.customer_id;
        const businessId = checkout.metadata?.business_id;

        if (businessId && customerId) {
          await serviceClient
            .from("subscriptions")
            .update({
              bachs_customer_id: customerId,
              provider_customer_id: customerId,
            })
            .eq("business_id", businessId);
        }
        break;
      }

      default:
        // Other events acknowledged
        break;
    }

    // 5. Mark webhook event as processed
    if (eventRecordId) {
      await serviceClient
        .from("webhook_events")
        .update({
          status: "processed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventRecordId);
    }

    return new Response("OK", { status: 200 });
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

    // Return 500 so Bachs retries transient failures
    return new Response("Internal Server Error", { status: 500 });
  }
}
