// ══════════════════════════════════════════════════════════════
import { getConfiguredOptionalEnv } from "@/lib/env";

// Plan Configuration
// ══════════════════════════════════════════════════════════════

export type PlanId = "free_trial" | "starter" | "growth" | "enterprise";

export type PlanConfig = {
  name: string;
  price_ngn: number | null; // null = custom pricing (enterprise)
  messages: number | null; // null = unlimited
  knowledge_sources: number | null;
  leads: number | null;
  widgets: number | null;
  embeddings: number | null;
  features: string[];
  paystack_plan_code: string | null; // placeholder — set via env later
  flutterwave_plan_id: string | null; // placeholder — set via env later
  contact_sales?: boolean;
};

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  free_trial: {
    name: "Free Trial",
    price_ngn: 0,
    messages: 100,
    knowledge_sources: 5,
    leads: 50,
    widgets: 1,
    embeddings: 1000,
    features: [
      "1 AI Assistant",
      "100 messages/month",
      "5 knowledge sources",
      "50 leads",
      "1 widget",
      "Basic support",
    ],
    paystack_plan_code: null,
    flutterwave_plan_id: null,
  },

  starter: {
    name: "Starter",
    price_ngn: 5000,
    messages: 5000,
    knowledge_sources: 25,
    leads: 1000,
    widgets: 1,
    embeddings: 20000,
    features: [
      "1 AI Assistant",
      "5,000 messages/month",
      "25 knowledge sources",
      "1,000 leads",
      "1 widget",
      "Email support",
      "Remove branding",
    ],
    paystack_plan_code: getConfiguredOptionalEnv("PAYSTACK_STARTER_PLAN_CODE"),
    flutterwave_plan_id: null,
  },

  growth: {
    name: "Growth",
    price_ngn: 15000,
    messages: 25000,
    knowledge_sources: 100,
    leads: 10000,
    widgets: 3,
    embeddings: 100000,
    features: [
      "3 AI Assistants",
      "25,000 messages/month",
      "100 knowledge sources",
      "10,000 leads",
      "3 widgets",
      "Priority support",
      "Remove branding",
      "Custom domain",
    ],
    paystack_plan_code: getConfiguredOptionalEnv("PAYSTACK_GROWTH_PLAN_CODE"),
    flutterwave_plan_id: null,
  },

  enterprise: {
    name: "Enterprise",
    price_ngn: null,
    messages: null, // unlimited
    knowledge_sources: null,
    leads: null,
    widgets: null,
    embeddings: null,
    features: [
      "Unlimited AI Assistants",
      "Unlimited messages",
      "Unlimited knowledge sources",
      "Unlimited leads",
      "Unlimited widgets",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
    ],
    paystack_plan_code: null,
    flutterwave_plan_id: null,
    contact_sales: true,
  },
};

/**
 * Helper to check if a plan limit is unlimited (null).
 */
export function isUnlimited(limit: number | null): boolean {
  return limit === null;
}

/**
 * Get plan config by plan ID, with fallback to free_trial.
 */
export function getPlanConfig(planId: string): PlanConfig {
  return PLAN_CONFIG[planId as PlanId] || PLAN_CONFIG.free_trial;
}

/**
 * Get the limits object for a plan (used for syncing to subscription).
 */
export function getPlanLimits(planId: string) {
  const plan = getPlanConfig(planId);
  return {
    message_limit: plan.messages ?? 999999999,
    knowledge_limit: plan.knowledge_sources ?? 999999999,
    lead_limit: plan.leads ?? 999999999,
    widget_limit: plan.widgets ?? 999999999,
    embedding_limit: plan.embeddings ?? 999999999,
  };
}

/**
 * Format price for display.
 */
export function formatPlanPrice(plan: PlanConfig): string {
  if (plan.price_ngn === null) return "Custom";
  if (plan.price_ngn === 0) return "Free";
  return `₦${plan.price_ngn.toLocaleString()}`;
}

/**
 * All plan IDs in order.
 */
export const PLAN_ORDER: PlanId[] = ["free_trial", "starter", "growth", "enterprise"];
