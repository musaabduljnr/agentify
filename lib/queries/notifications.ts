import { createServiceClient } from "@/utils/supabase/service";
import { getUsageSummary } from "@/lib/billing/usage";

export type DashboardNotification = {
  id: string;
  title: string;
  message: string;
  href: string;
  level: "info" | "warning" | "critical" | "success";
};

export async function getDashboardNotifications(
  businessId: string,
  subscription?: { status?: string; plan?: string } | null
): Promise<DashboardNotification[]> {
  const notifications: DashboardNotification[] = [];
  const supabase = createServiceClient();

  if (subscription?.status && !["active", "trialing"].includes(subscription.status)) {
    notifications.push({
      id: "billing-status",
      title: "Billing needs attention",
      message: `Your subscription is ${subscription.status.replace("_", " ")}.`,
      href: "/dashboard/billing",
      level: subscription.status === "past_due" ? "critical" : "warning",
    });
  }

  try {
    const usage = await getUsageSummary(businessId);
    const checks = [
      ["messages", "AI messages", usage.messages],
      ["embeddings", "Embeddings", usage.embeddings],
      ["leads", "Leads", usage.leads],
      ["knowledge_sources", "Knowledge sources", usage.knowledge_sources],
    ] as const;

    for (const [key, label, data] of checks) {
      if (data.limit >= 999999999) continue;
      const percentage = Math.round((data.used / data.limit) * 100);
      if (percentage >= 100) {
        notifications.push({
          id: `usage-${key}-critical`,
          title: `${label} limit reached`,
          message: `${data.used.toLocaleString()} of ${data.limit.toLocaleString()} used.`,
          href: "/dashboard/billing",
          level: "critical",
        });
      } else if (percentage >= 80) {
        notifications.push({
          id: `usage-${key}-warning`,
          title: `${label} almost used up`,
          message: `${percentage}% of your monthly limit is used.`,
          href: "/dashboard/billing",
          level: "warning",
        });
      }
    }
  } catch {
    // Notification rendering should not block the dashboard.
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [
    { count: failedKnowledgeCount },
    { count: newLeadCount },
    { count: openConversationCount },
    { data: trainedSources },
  ] = await Promise.all([
    supabase
      .from("knowledge_sources")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "failed"),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "new")
      .gte("created_at", since),
    supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "open")
      .gte("updated_at", since),
    supabase
      .from("knowledge_sources")
      .select("id, metadata")
      .eq("business_id", businessId)
      .eq("status", "trained"),
  ]);

  if ((failedKnowledgeCount || 0) > 0) {
    notifications.push({
      id: "failed-knowledge",
      title: "Knowledge processing failed",
      message: `${failedKnowledgeCount} source${failedKnowledgeCount === 1 ? "" : "s"} need attention.`,
      href: "/dashboard/knowledge",
      level: "critical",
    });
  }

  const unembeddedCount = (trainedSources || []).filter((source: any) => !source.metadata?.embedded).length;
  if (unembeddedCount > 0) {
    notifications.push({
      id: "knowledge-not-embedded",
      title: "Knowledge ready to embed",
      message: `${unembeddedCount} trained source${unembeddedCount === 1 ? "" : "s"} still need chunks.`,
      href: "/dashboard/knowledge",
      level: "warning",
    });
  }

  if ((newLeadCount || 0) > 0) {
    notifications.push({
      id: "new-leads",
      title: "New leads captured",
      message: `${newLeadCount} new lead${newLeadCount === 1 ? "" : "s"} in the last 24 hours.`,
      href: "/dashboard/leads",
      level: "success",
    });
  }

  if ((openConversationCount || 0) > 0) {
    notifications.push({
      id: "open-conversations",
      title: "Open conversations",
      message: `${openConversationCount} active conversation${openConversationCount === 1 ? "" : "s"} updated today.`,
      href: "/dashboard/conversations",
      level: "info",
    });
  }

  return notifications.slice(0, 8);
}
