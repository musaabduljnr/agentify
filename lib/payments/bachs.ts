import "server-only";
import { Bachs, webhooks, BachsWebhookError, BachsApiError } from "@bachs/sdk";
import { getSecretWithEnvFallback } from "@/lib/config/platform-config";

/**
 * Singleton instance or factory for the official Bachs server SDK client.
 */
let cachedClient: Bachs | null = null;
let cachedApiKey: string | null = null;

export async function getBachsApiKey(): Promise<string> {
  const key = await getSecretWithEnvFallback("bachs", "api_key", "BACHS_API_KEY");
  return (key || "").trim();
}

export async function getBachsWebhookSecret(): Promise<string> {
  const secret = await getSecretWithEnvFallback("bachs", "webhook_secret", "BACHS_WEBHOOK_SECRET");
  return (secret || "").trim();
}

export async function getBachsClient(): Promise<Bachs> {
  const apiKey = await getBachsApiKey();
  if (!apiKey || apiKey.includes("placeholder")) {
    throw new Error(
      "Bachs API Key is not configured. Please set BACHS_API_KEY in environment or database platform settings."
    );
  }

  if (cachedClient && cachedApiKey === apiKey) {
    return cachedClient;
  }

  const customBaseUrl = process.env.BACHS_API_URL?.trim();

  cachedClient = new Bachs({
    apiKey,
    baseURL: customBaseUrl || undefined,
  });
  cachedApiKey = apiKey;

  return cachedClient;
}

export interface CreateBachsCheckoutParams {
  productId: string;
  customerEmail: string;
  customerName?: string;
  customerId?: string | null;
  businessId: string;
  userId: string;
  plan: "starter" | "growth";
  successUrl: string;
  cancelUrl: string;
}

/**
 * Creates a Bachs hosted checkout session for a recurring product.
 * Enforces USD currency and binds user/business metadata.
 */
export async function createBachsCheckoutSession(params: CreateBachsCheckoutParams) {
  const bachs = await getBachsClient();

  const customerPayload = params.customerId
    ? { customer_id: params.customerId }
    : {
        email: params.customerEmail,
        name: params.customerName || undefined,
      };

  const idempotencyKey = `checkout-${params.businessId}-${params.plan}-${Date.now()}`;

  const session = await bachs.checkoutSessions.create(
    {
      product_cart: [{ product_id: params.productId, quantity: 1 }],
      customer: customerPayload,
      billing_currency: "USD",
      metadata: {
        user_id: params.userId,
        business_id: params.businessId,
        plan: params.plan,
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    },
    { idempotencyKey }
  );

  return {
    checkoutId: session.checkout_id,
    checkoutUrl: session.checkout_url,
    status: session.status,
  };
}

/**
 * Creates an authenticated short-lived customer portal session URL.
 * Redirects user to manage subscriptions, cards, invoices, and cancellations.
 */
export async function createBachsCustomerPortalSession(customerId: string) {
  const bachs = await getBachsClient();
  const session = await bachs.customerPortal.createSession(customerId);
  return {
    id: session.id,
    url: session.url,
  };
}

/**
 * Cancels a subscription in Bachs.
 * cancelAtPeriodEnd = true allows access to continue until current_period_end.
 */
export async function cancelBachsSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
) {
  const bachs = await getBachsClient();
  return bachs.subscriptions.cancel(subscriptionId, {
    cancel_at_period_end: cancelAtPeriodEnd,
  });
}

/**
 * Retrieves authoritative subscription details from Bachs.
 */
export async function getBachsSubscription(subscriptionId: string) {
  const bachs = await getBachsClient();
  return bachs.subscriptions.get(subscriptionId);
}

/**
 * Verifies raw webhook body against signature using official Bachs SDK.
 */
export function verifyBachsWebhookEvent(
  rawBody: string,
  headers: Headers | Record<string, string | string[] | undefined>,
  secret: string
) {
  try {
    return webhooks.constructEvent(rawBody, headers as any, secret);
  } catch (err) {
    if (err instanceof BachsWebhookError) {
      throw new Error(`Invalid Bachs webhook signature: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Creates a recurring product in Bachs. Used during initial setup or product provisioning.
 */
export async function createBachsRecurringProduct(params: {
  name: string;
  amountDecimal: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}) {
  const bachs = await getBachsClient();
  return bachs.products.create(
    {
      name: params.name,
      price: {
        currency: "USD",
        amount: params.amountDecimal,
      },
      billing_cycle: {
        interval: "month",
        frequency: 1,
      },
      metadata: params.metadata,
    },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined
  );
}

export { BachsApiError, BachsWebhookError };
