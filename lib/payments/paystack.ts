import crypto from "crypto";

type JsonRecord = Record<string, unknown>;

interface PaystackInitializeInput {
  email: string;
  amount: number; // In Naira (converted to Kobo internally)
  planCode?: string | null;
  reference: string;
  businessId: string;
  callbackUrl: string;
  metadata?: JsonRecord;
}

export async function initializePaystackTransaction(input: PaystackInitializeInput) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not defined in the environment variables.");
  }

  // Paystack expects amount in Kobo
  const amountInKobo = Math.round(input.amount * 100);

  const payload: JsonRecord = {
    email: input.email,
    amount: amountInKobo,
    reference: input.reference,
    callback_url: input.callbackUrl,
    metadata: {
      businessId: input.businessId,
      plan: input.planCode ? undefined : input.metadata?.plan, // reference plan if one-time payment
      userId: input.metadata?.userId,
      provider: "paystack",
      ...input.metadata,
    },
  };

  // If a recurring plan code is available, attach it to subscription flow
  if (input.planCode) {
    payload.plan = input.planCode;
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || "Failed to initialize Paystack transaction.");
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

export async function verifyPaystackTransaction(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not defined in the environment variables.");
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || "Failed to verify Paystack transaction.");
  }

  return data.data;
}

export function verifyPaystackWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return false;

  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  return hash === signature;
}

export function parsePaystackWebhook(body: unknown): { event: string; data: JsonRecord } {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid webhook payload.");
  }

  const payload = body as { event?: unknown; data?: unknown };
  if (typeof payload.event !== "string" || !payload.data || typeof payload.data !== "object") {
    throw new Error("Invalid Paystack webhook payload.");
  }

  return {
    event: payload.event,
    data: payload.data as JsonRecord,
  };
}
