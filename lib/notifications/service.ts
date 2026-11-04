import "server-only";

import { createServiceClient } from "@/utils/supabase/service";

export const NOTIFICATION_CATEGORIES = [
  "leads",
  "booking",
  "support",
  "usage",
  "billing",
  "knowledge",
  "team",
  "system",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export interface CreateBusinessNotificationInput {
  businessId: string;
  eventKey: string;
  category: NotificationCategory;
  title: string;
  message: string;
  href: string;
  severity?: NotificationSeverity;
  metadata?: Record<string, unknown>;
}

export interface CreatedBusinessNotification {
  ownerNotificationId: string | null;
  notifications: Array<{ id: string; userId: string }>;
}

export async function createBusinessNotification(
  input: CreateBusinessNotificationInput
): Promise<CreatedBusinessNotification> {
  const supabase = createServiceClient();
  const [businessResult, membersResult, preferenceResult] = await Promise.all([
    supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", input.businessId)
      .maybeSingle(),
    supabase
      .from("business_members")
      .select("user_id")
      .eq("business_id", input.businessId)
      .eq("status", "active")
      .not("user_id", "is", null),
    supabase
      .from("notification_preferences")
      .select("user_id, in_app_enabled")
      .eq("business_id", input.businessId)
      .eq("category", input.category),
  ]);

  if (businessResult.error) throw new Error(businessResult.error.message);
  if (!businessResult.data) throw new Error("Cannot notify a missing business.");
  if (membersResult.error) throw new Error(membersResult.error.message);
  if (preferenceResult.error) throw new Error(preferenceResult.error.message);
  const ownerId = businessResult.data.owner_id;

  const preferenceByUser = new Map<string, boolean>();
  let businessDefault = true;
  for (const preference of preferenceResult.data || []) {
    if (preference.user_id) {
      preferenceByUser.set(preference.user_id, preference.in_app_enabled);
    } else {
      businessDefault = preference.in_app_enabled;
    }
  }

  const recipientIds = new Set<string>([ownerId]);
  for (const member of membersResult.data || []) {
    if (member.user_id) recipientIds.add(member.user_id);
  }

  const archivedAt = new Date().toISOString();
  const rows = [...recipientIds].map((userId) => {
    const inAppEnabled = preferenceByUser.get(userId) ?? businessDefault;
    return {
      business_id: input.businessId,
      user_id: userId,
      category: input.category,
      event_key: input.eventKey,
      title: input.title,
      message: input.message,
      href: input.href,
      severity: input.severity || "info",
      metadata: input.metadata || {},
      archived_at: inAppEnabled ? null : archivedAt,
    };
  });

  const { error } = await supabase
    .from("notifications")
    .upsert(rows, {
      onConflict: "business_id,user_id,event_key",
      ignoreDuplicates: true,
    })
    .select("id, user_id");

  if (error) throw new Error(`Failed to persist notification: ${error.message}`);
  const { data: persistedRows, error: readError } = await supabase
    .from("notifications")
    .select("id, user_id")
    .eq("business_id", input.businessId)
    .eq("event_key", input.eventKey)
    .in("user_id", [...recipientIds]);
  if (readError) throw new Error(`Failed to retrieve persisted notification: ${readError.message}`);

  const notifications = (persistedRows || []).map((row) => ({ id: row.id, userId: row.user_id }));
  const ownerNotificationId =
    notifications.find((notification) => notification.userId === ownerId)?.id ||
    null;

  return { ownerNotificationId, notifications };
}
