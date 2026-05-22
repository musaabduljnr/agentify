"use server";

// ══════════════════════════════════════════════════════════════
// Billing Queries (for dashboard page components)
// ══════════════════════════════════════════════════════════════

import { createClient } from "@/utils/supabase/server";
import { getUsageSummary } from "@/lib/billing/usage";
import { getCurrentPlan } from "@/lib/billing/subscription";

/**
 * Get subscription and usage data for the current user's business.
 * Used by dashboard pages to display billing info and warnings.
 */
export async function getBusinessBillingContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) return null;

  try {
    const [planData, usage] = await Promise.all([
      getCurrentPlan(business.id),
      getUsageSummary(business.id),
    ]);

    if (!planData) return null;

    // Compute warnings
    const warnings: any[] = [];
    const check = (type: string, label: string, data: { used: number; limit: number }) => {
      if (data.limit >= 999999999) return;
      const pct = Math.round((data.used / data.limit) * 100);
      if (pct >= 100) {
        warnings.push({ type, label, level: "critical", used: data.used, limit: data.limit, percentage: pct });
      } else if (pct >= 80) {
        warnings.push({ type, label, level: "warning", used: data.used, limit: data.limit, percentage: pct });
      }
    };

    check("messages", "AI Messages", usage.messages);
    check("embeddings", "Embeddings", usage.embeddings);
    check("leads", "Leads", usage.leads);
    check("knowledge_sources", "Knowledge Sources", usage.knowledge_sources);

    return {
      businessId: business.id,
      plan: planData.planId,
      planName: planData.plan.name,
      usage,
      warnings,
    };
  } catch (e) {
    console.error("getBusinessBillingContext error:", e);
    return null;
  }
}
