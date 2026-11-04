import "server-only";

import { createServiceClient } from "@/utils/supabase/service";
import type { NotificationCategory, NotificationSeverity } from "@/lib/notifications/service";

export type DashboardNotification = {
  id: string;
  title: string;
  message: string;
  href: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  created_at: string;
  read_at: string | null;
};

export async function getDashboardNotifications(
  businessId: string,
  userId: string
): Promise<{ notifications: DashboardNotification[]; unreadCount: number }> {
  const supabase = createServiceClient();
  const [feedResult, unreadResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, message, href, severity, category, created_at, read_at")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .is("read_at", null)
      .is("archived_at", null),
  ]);

  if (feedResult.error) throw new Error(`Failed to load dashboard notifications: ${feedResult.error.message}`);
  if (unreadResult.error) throw new Error(`Failed to count dashboard notifications: ${unreadResult.error.message}`);
  return {
    notifications: (feedResult.data || []) as DashboardNotification[],
    unreadCount: unreadResult.count || 0,
  };
}
