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
      "id, business_id, plan, status, current_period_end"
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

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : Number.NaN;
  if (!Number.isFinite(periodEnd) || periodEnd <= Date.now()) {
    return denied(businessId, "expired_period");
  }

  const planConfig = await getEffectivePlanConfig(subscription.plan);
  const finiteLimit = (value: number | null) => value ?? 999999999;

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
      messages: finiteLimit(planConfig.messages),
      knowledgeSources: finiteLimit(planConfig.knowledge_sources),
      assistants: finiteLimit(planConfig.widgets),
      leads: finiteLimit(planConfig.leads),
      embeddings: finiteLimit(planConfig.embeddings),
      teamMembers: finiteLimit(planConfig.team_members),
      dailyMessages: finiteLimit(planConfig.daily_messages),
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

export async function hasVerifiedPaymentForCurrentPeriod(subscription: {
  business_id: string;
  plan: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}): Promise<boolean> {
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : Number.NaN;
  if (!Number.isFinite(periodEnd) || periodEnd <= Date.now()) return false;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("id")
    .eq("business_id", subscription.business_id)
    .eq("plan", subscription.plan)
    .eq("status", "success")
    .not("verified_at", "is", null)
    .gte("verified_at", subscription.current_period_start || subscription.created_at)
    .lte("verified_at", subscription.current_period_end!)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Entitlements] Failed to verify current-period payment", {
      businessId: subscription.business_id,
      error,
    });
    throw new Error("Unable to verify the current subscription payment.");
  }
  return Boolean(data);
}
