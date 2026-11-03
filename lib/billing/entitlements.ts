import "server-only";

import { getEffectivePlanConfig } from "@/lib/billing/platform";
import { createServiceClient } from "@/utils/supabase/service";

export type PaidPlanId = "starter" | "growth" | "enterprise" | "business";

export type BusinessEntitlements = {
  businessId: string;
  active: boolean;
  plan: PaidPlanId | null;
  reason: "active" | "no_subscription" | "inactive_subscription" | "expired_period" | "unknown_plan" | "lookup_failed";
  canUseAi: boolean;
  canCreateAssistant: boolean;
  canAddKnowledge: boolean;
  canCaptureLeads: boolean;
  canUseTeamFeatures: boolean;
  canRemoveBranding: boolean;
  limits: {
    messages: number;
    knowledgeSources: number;
    assistants: number;
    leads: number;
    embeddings: number;
    teamMembers: number;
    dailyMessages: number;
  };
};

const DENIED_LIMITS = {
  messages: 0,
  knowledgeSources: 0,
  assistants: 0,
  leads: 0,
  embeddings: 0,
  teamMembers: 0,
  dailyMessages: 0,
};

function denied(
  businessId: string,
  reason: BusinessEntitlements["reason"]
): BusinessEntitlements {
  return {
    businessId,
    active: false,
    plan: null,
    reason,
    canUseAi: false,
    canCreateAssistant: false,
    canAddKnowledge: false,
    canCaptureLeads: false,
    canUseTeamFeatures: false,
    canRemoveBranding: false,
    limits: DENIED_LIMITS,
  };
}

function validPlan(plan: string): plan is PaidPlanId {
  return plan === "starter" || plan === "growth" || plan === "enterprise" || plan === "business";
}

/**
 * Resolves paid features from the authoritative subscription row.
 * The caller must establish business ownership before exposing this result.
 */
export async function resolveBusinessEntitlements(
  businessId: string
): Promise<BusinessEntitlements> {
  const supabase = createServiceClient();
  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select(
      "id, business_id, plan, status, message_limit, knowledge_limit, lead_limit, widget_limit, embedding_limit, team_member_limit, daily_message_limit, current_period_end"
    )
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    console.error("[Entitlements] Failed to load subscription", { businessId, error });
    return denied(businessId, "lookup_failed");
  }
  if (!subscription) return denied(businessId, "no_subscription");
  if (!validPlan(subscription.plan)) return denied(businessId, "unknown_plan");
  if (subscription.status !== "active") return denied(businessId, "inactive_subscription");

  if (
    subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() <= Date.now()
  ) {
    return denied(businessId, "expired_period");
  }

  const planConfig = await getEffectivePlanConfig(subscription.plan);
  const finiteLimit = (value: number | null | undefined, fallback: number | null) =>
    value ?? fallback ?? 999999999;

  return {
    businessId,
    active: true,
    plan: subscription.plan,
    reason: "active",
    canUseAi: true,
    canCreateAssistant: true,
    canAddKnowledge: true,
    canCaptureLeads: true,
    canUseTeamFeatures: true,
    canRemoveBranding: subscription.plan !== "starter",
    limits: {
      messages: finiteLimit(subscription.message_limit, planConfig.messages),
      knowledgeSources: finiteLimit(subscription.knowledge_limit, planConfig.knowledge_sources),
      assistants: finiteLimit(subscription.widget_limit, planConfig.widgets),
      leads: finiteLimit(subscription.lead_limit, planConfig.leads),
      embeddings: finiteLimit(subscription.embedding_limit, planConfig.embeddings),
      teamMembers: finiteLimit(subscription.team_member_limit, planConfig.team_members),
      dailyMessages: finiteLimit(subscription.daily_message_limit, planConfig.daily_messages),
    },
  };
}

export async function requireBusinessEntitlement(
  businessId: string,
  entitlement: keyof Pick<
    BusinessEntitlements,
    | "canUseAi"
    | "canCreateAssistant"
    | "canAddKnowledge"
    | "canCaptureLeads"
    | "canUseTeamFeatures"
  >
): Promise<BusinessEntitlements> {
  const entitlements = await resolveBusinessEntitlements(businessId);
  if (!entitlements.active || !entitlements[entitlement]) {
    throw new Error(
      entitlements.reason === "active"
        ? "This feature is not included in your current plan."
        : "An active subscription is required to use this feature."
    );
  }
  return entitlements;
}
