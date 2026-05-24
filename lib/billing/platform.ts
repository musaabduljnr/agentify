import { createServiceClient } from "@/utils/supabase/service";
import {
  getPlanConfig,
  getPlanLimits,
  PLAN_CONFIG,
  PLAN_ORDER,
  type PlanConfig,
  type PlanId,
} from "@/lib/billing/plans";

export type BillingPlatformSettings = {
  currency: string;
  currency_symbol: string;
  default_payment_provider: "paystack" | "flutterwave" | "manual";
};

export type EditablePlanConfig = PlanConfig & {
  id: PlanId;
};

export const DEFAULT_BILLING_SETTINGS: BillingPlatformSettings = {
  currency: "NGN",
  currency_symbol: "₦",
  default_payment_provider: "paystack",
};

function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function mergePlanConfig(planId: PlanId, override: Record<string, unknown> | null | undefined): EditablePlanConfig {
  const fallback = getPlanConfig(planId);
  const price = Object.prototype.hasOwnProperty.call(override || {}, "price_ngn")
    ? asFiniteNumber(override?.price_ngn)
    : fallback.price_ngn;

  return {
    id: planId,
    name: typeof override?.name === "string" && override.name.trim() ? override.name.trim() : fallback.name,
    price_ngn: price,
    messages: Object.prototype.hasOwnProperty.call(override || {}, "messages")
      ? asFiniteNumber(override?.messages)
      : fallback.messages,
    knowledge_sources: Object.prototype.hasOwnProperty.call(override || {}, "knowledge_sources")
      ? asFiniteNumber(override?.knowledge_sources)
      : fallback.knowledge_sources,
    leads: Object.prototype.hasOwnProperty.call(override || {}, "leads")
      ? asFiniteNumber(override?.leads)
      : fallback.leads,
    widgets: Object.prototype.hasOwnProperty.call(override || {}, "widgets")
      ? asFiniteNumber(override?.widgets)
      : fallback.widgets,
    embeddings: Object.prototype.hasOwnProperty.call(override || {}, "embeddings")
      ? asFiniteNumber(override?.embeddings)
      : fallback.embeddings,
    features: asStringArray(override?.features, fallback.features),
    paystack_plan_code:
      typeof override?.paystack_plan_code === "string" && override.paystack_plan_code.trim()
        ? override.paystack_plan_code.trim()
        : fallback.paystack_plan_code,
    flutterwave_plan_id:
      typeof override?.flutterwave_plan_id === "string" && override.flutterwave_plan_id.trim()
        ? override.flutterwave_plan_id.trim()
        : fallback.flutterwave_plan_id,
    contact_sales:
      typeof override?.contact_sales === "boolean" ? override.contact_sales : fallback.contact_sales,
  };
}

export function formatCurrencyAmount(
  amount: number | null,
  settings: BillingPlatformSettings = DEFAULT_BILLING_SETTINGS
): string {
  if (amount === null) return "Custom";
  if (amount === 0) return "Free";
  const symbol = settings.currency_symbol || settings.currency;
  return `${symbol}${amount.toLocaleString("en-US")}`;
}

export async function getBillingPlatformSettings(): Promise<BillingPlatformSettings> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "billing")
      .maybeSingle();

    if (error || !data?.value) return DEFAULT_BILLING_SETTINGS;

    const value = data.value as Partial<BillingPlatformSettings>;
    return {
      currency: value.currency || DEFAULT_BILLING_SETTINGS.currency,
      currency_symbol: value.currency_symbol || DEFAULT_BILLING_SETTINGS.currency_symbol,
      default_payment_provider:
        value.default_payment_provider || DEFAULT_BILLING_SETTINGS.default_payment_provider,
    };
  } catch {
    return DEFAULT_BILLING_SETTINGS;
  }
}

export async function getEffectivePlanConfigs(): Promise<Record<PlanId, EditablePlanConfig>> {
  const defaults = PLAN_ORDER.reduce((acc, planId) => {
    acc[planId] = mergePlanConfig(planId, null);
    return acc;
  }, {} as Record<PlanId, EditablePlanConfig>);

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("billing_plan_overrides").select("*");
    if (error || !data) return defaults;

    for (const row of data) {
      const planId = row.plan_id as PlanId;
      if (!PLAN_CONFIG[planId]) continue;
      defaults[planId] = mergePlanConfig(planId, row.config as Record<string, unknown>);
    }

    return defaults;
  } catch {
    return defaults;
  }
}

export async function getEffectivePlanConfig(planId: string): Promise<EditablePlanConfig> {
  const configs = await getEffectivePlanConfigs();
  return configs[planId as PlanId] || configs.free_trial;
}

export async function getEffectivePlanLimits(planId: string) {
  const plan = await getEffectivePlanConfig(planId);
  return {
    message_limit: plan.messages ?? 999999999,
    knowledge_limit: plan.knowledge_sources ?? 999999999,
    lead_limit: plan.leads ?? 999999999,
    widget_limit: plan.widgets ?? 999999999,
    embedding_limit: plan.embeddings ?? 999999999,
  };
}

export function getStaticPlanLimits(planId: string) {
  return getPlanLimits(planId);
}
