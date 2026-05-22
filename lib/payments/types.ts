// ══════════════════════════════════════════════════════════════
// Payment Provider Types (Provider-Agnostic)
// ══════════════════════════════════════════════════════════════

export type PaymentProvider = "manual" | "paystack" | "flutterwave";

export type PaymentPlan = {
  id: string;
  name: string;
  amount: number; // in kobo (Paystack) or smallest currency unit
  currency: string;
  interval: "monthly" | "yearly";
  provider: PaymentProvider;
  provider_plan_code: string | null;
};

export type PaymentCheckoutRequest = {
  business_id: string;
  plan_id: string;
  provider: PaymentProvider;
  customer_email: string;
  customer_name?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
};

export type PaymentCheckoutResponse = {
  authorization_url: string;
  access_code?: string;
  reference: string;
  provider: PaymentProvider;
};

export type PaymentWebhookPayload = {
  provider: PaymentProvider;
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    currency: string;
    customer: {
      email: string;
      customer_code?: string;
    };
    plan?: {
      plan_code: string;
    };
    subscription?: {
      subscription_code: string;
      status: string;
    };
    metadata?: Record<string, any>;
  };
};

export type SubscriptionStatus = 
  | "active" 
  | "inactive" 
  | "cancelled" 
  | "suspended" 
  | "trialing" 
  | "past_due";

export type PaymentInvoice = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed";
  provider: PaymentProvider;
  created_at: string;
};
