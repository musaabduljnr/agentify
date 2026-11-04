"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentBusinessSetup } from "@/lib/queries/business";
import { createServiceClient } from "@/utils/supabase/service";

const notificationIdSchema = z.string().uuid();

export async function getNotificationFeed() {
  const setup = await getCurrentBusinessSetup();
  if (!setup.user || !setup.business) {
    return { notifications: [], unreadCount: 0 };
  }

  const supabase = createServiceClient();
  const [feedResult, unreadResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, message, href, severity, category, created_at, read_at")
      .eq("business_id", setup.business.id)
      .eq("user_id", setup.user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("business_id", setup.business.id)
      .eq("user_id", setup.user.id)
      .is("read_at", null)
      .is("archived_at", null),
  ]);

  if (feedResult.error) throw new Error(`Failed to load notifications: ${feedResult.error.message}`);
  if (unreadResult.error) throw new Error(`Failed to count unread notifications: ${unreadResult.error.message}`);

  return {
    notifications: feedResult.data || [],
    unreadCount: unreadResult.count || 0,
  };
}

export async function markNotificationRead(notificationId: string) {
  const parsedId = notificationIdSchema.safeParse(notificationId);
  if (!parsedId.success) return { error: "Invalid notification." };

  const setup = await getCurrentBusinessSetup();
  if (!setup.user || !setup.business) return { error: "Unauthorized" };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .eq("business_id", setup.business.id)
    .eq("user_id", setup.user.id)
    .is("read_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { error: `Failed to mark notification as read: ${error.message}` };
  if (data) revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const setup = await getCurrentBusinessSetup();
  if (!setup.user || !setup.business) return { error: "Unauthorized" };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", setup.business.id)
    .eq("user_id", setup.user.id)
    .is("read_at", null)
    .is("archived_at", null);

  if (error) return { error: `Failed to mark notifications as read: ${error.message}` };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/notifications");
  return { success: true };
}
