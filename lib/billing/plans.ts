// ══════════════════════════════════════════════════════════════
import { getConfiguredOptionalEnv } from "@/lib/env";

// Plan Configuration
// ══════════════════════════════════════════════════════════════

export type PlanId = "starter" | "growth" | "enterprise" | "business";

export type PlanConfig = {
  name: string;
  price_usd: number | null;
  price_ngn?: number | null; // deprecated - null for all plans
  amount_decimal?: string | null; // e.g. "2.00", "10.00"
  messages: number | null; // null = unlimited
  daily_messages: number | null; // null = unlimited
  knowledge_sources: number | null;
  leads: number | null;
  widgets: number | null;
  embeddings: number | null;
  team_members: number | null; // null = unlimited
  features: string[];
  bachs_product_id: string | null;
  contact_sales?: boolean;
  highlighted?: boolean;
};

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  starter: {
    name: "Starter",
    price_usd: 2,
    price_ngn: null,
    amount_decimal: "2.00",
    messages: 200,
    daily_messages: 50,
    knowledge_sources: 25,
    leads: 50,
    widgets: 1,
    embeddings: 5000,
    team_members: 1,
    features: [
      "1 AI Assistant",
      "200 AI replies/month",
      "25 knowledge sources",
      "50 leads captured",
      "1 chat widget",
      "Basic analytics",
      "Email support",
      "Agentify branding",
    ],
    bachs_product_id: getConfiguredOptionalEnv("BACHS_STARTER_PRODUCT_ID"),
  },

  growth: {
    name: "Growth",
    price_usd: 10,
    price_ngn: null,
    amount_decimal: "10.00",
    messages: 1500,
    daily_messages: 200,
    knowledge_sources: 100,
    leads: null, // unlimited leads
    widgets: 3,
    embeddings: 50000,
    team_members: 3,
    highlighted: true,
    features: [
      "Up to 3 AI Assistants",
      "1,500 AI replies/month",
      "100 knowledge sources",
      "Unlimited leads captured",
      "3 chat widgets",
      "Advanced analytics",
      "Remove Agentify branding",
      "Custom domain & webhooks",
      "Priority email support",
    ],
    bachs_product_id: getConfiguredOptionalEnv("BACHS_GROWTH_PRODUCT_ID"),
  },

  enterprise: {
    name: "Enterprise",
    price_usd: null,
    price_ngn: null,
    amount_decimal: null,
    messages: null, // unlimited
    daily_messages: null,
    knowledge_sources: null,
    leads: null,
    widgets: null,
    embeddings: null,
    team_members: null,
    features: [
      "Unlimited AI Assistants",
      "Custom AI reply volume",
      "Unlimited knowledge sources",
      "Unlimited leads",
      "Unlimited widgets",
      "Custom integrations & CRM sync",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom training & onboarding",
    ],
    bachs_product_id: null,
    contact_sales: true,
  },

  /**
   * LEGACY PLAN — "business" (Audit M6)
   * Preserved exclusively for backward compatibility with existing grandfathered subscribers.
   * This plan is intentionally excluded from PLAN_ORDER and is not selectable in onboarding
   * or the pricing/upgrade UI. Do not delete without migrating existing customers.
   */
  business: {
    name: "Business",
    price_usd: 35,
    price_ngn: null,
    amount_decimal: "35.00",
    messages: 50000,
    daily_messages: 2500,
    knowledge_sources: 250,
    leads: 25000,
    widgets: 5,
    embeddings: 250000,
    team_members: 10,
    features: [
      "5 AI Assistants",
      "50,000 messages/month",
      "2,500 daily messages soft cap",
      "250 knowledge sources",
      "25,000 leads",
      "5 widgets",
      "Dedicated account manager",
      "Remove branding",
      "Custom domain & webhooks",
    ],
    bachs_product_id: null,
  },
};

/**
 * Helper to check if a plan limit is unlimited (null).
 */
export function isUnlimited(limit: number | null): boolean {
  return limit === null;
}

/**
 * Get plan config by plan ID, with fallback to starter.
 */
export function getPlanConfig(planId: string): PlanConfig {
  return PLAN_CONFIG[planId as PlanId] || PLAN_CONFIG.starter;
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
    daily_message_limit: plan.daily_messages ?? 999999999,
    team_member_limit: plan.team_members ?? 999999999,
  };
}

/**
 * Format price for display.
 */
export function formatPlanPrice(plan: PlanConfig, currency: "USD" | "NGN" = "USD"): string {
  if (plan.price_usd === null && plan.price_ngn === null) return "Custom";
  if (currency === "USD") {
    if (plan.price_usd === 0) return "Free";
    return `$${plan.price_usd}/mo`;
  }
  if (plan.price_ngn === 0) return "Free";
  return `₦${plan.price_ngn?.toLocaleString()}/mo`;
}

/**
 * All active public plan IDs in order.
 */
export const PLAN_ORDER: PlanId[] = ["starter", "growth", "enterprise"];
