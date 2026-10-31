// ══════════════════════════════════════════════════════════════
// Bachs Payment Provider Types (USD Only)
// ══════════════════════════════════════════════════════════════

export type PaymentProvider = "bachs" | "manual";

export type PaymentPlan = {
  id: string;
  name: string;
  amount: string; // e.g. "2.00", "10.00"
  currency: "USD";
  interval: "monthly";
  provider: PaymentProvider;
  product_id: string | null;
};

export type PaymentCheckoutRequest = {
  business_id: string;
  plan_id: string;
  customer_email: string;
  customer_name?: string;
  customer_id?: string; // Bachs cust_...
  success_url?: string;
  cancel_url?: string;
  metadata?: Record<string, string>;
};

export type PaymentCheckoutResponse = {
  checkout_id: string;
  checkout_url: string;
  status: string;
};

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "paused"
  | "pending";

export type PaymentInvoice = {
  id: string;
  reference: string;
  amount: string;
  currency: "USD";
  status: "paid" | "pending" | "failed";
  provider: PaymentProvider;
  created_at: string;
};
