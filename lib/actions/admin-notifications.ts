"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createBusinessNotification } from "@/lib/notifications/service";
import { createServiceClient } from "@/utils/supabase/service";

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(1000),
  href: z.string().trim().regex(/^\/dashboard(?:\/|$)/).refine((value) => !value.startsWith("//")),
  businessId: z.string().uuid().optional().or(z.literal("")),
});

export async function getAdminAnnouncements() {
  await requireAdmin();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_announcements")
    .select("id, title, message, href, business_id, audience_all_businesses, status, recipient_count, error_details, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(`Failed to load announcements: ${error.message}`);
  return data || [];
}

export async function createAdminAnnouncement(input: {
  title: string;
  message: string;
  href: string;
  businessId?: string;
}) {
  const admin = await requireAdmin();
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid announcement." };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_announcements")
    .insert({
      created_by: admin.id,
      title: parsed.data.title,
      message: parsed.data.message,
      href: parsed.data.href,
      business_id: parsed.data.businessId || null,
      audience_all_businesses: !parsed.data.businessId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `Failed to create announcement: ${error?.message || "No announcement was returned."}` };
  }

  return dispatchAdminAnnouncement(data.id);
}

export async function retryAdminAnnouncement(announcementId: string) {
  await requireAdmin();
  const parsedId = z.string().uuid().safeParse(announcementId);
  if (!parsedId.success) return { error: "Invalid announcement." };
  return dispatchAdminAnnouncement(parsedId.data);
}

async function dispatchAdminAnnouncement(announcementId: string) {
  const supabase = createServiceClient();
  const { data: announcement, error: announcementError } = await supabase
    .from("notification_announcements")
    .select("id, title, message, href, business_id, audience_all_businesses, status")
    .eq("id", announcementId)
    .maybeSingle();

  if (announcementError) return { error: `Failed to load announcement: ${announcementError.message}` };
  if (!announcement) return { error: "Announcement not found." };
  if (announcement.status === "sent") return { error: "This announcement has already been sent." };

  const { error: startError } = await supabase
    .from("notification_announcements")
    .update({ status: "sending", error_details: [] })
    .eq("id", announcement.id);
  if (startError) return { error: `Failed to start announcement: ${startError.message}` };

  let businesses: Array<{ id: string }> = [];
  if (!announcement.audience_all_businesses && announcement.business_id) {
    businesses = [{ id: announcement.business_id }];
  } else if (announcement.audience_all_businesses) {
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("businesses")
        .select("id")
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) {
        await markAnnouncementFailed(supabase, announcement.id, error.message);
        return { error: `Failed to find announcement recipients: ${error.message}` };
      }
      businesses.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
  } else {
    const message = "Target business no longer exists.";
    await markAnnouncementFailed(supabase, announcement.id, message);
    return { error: message };
  }

  let recipientCount = 0;
  const failures: Array<{ businessId: string; error: string }> = [];
  for (let index = 0; index < businesses.length; index += 10) {
    const batch = businesses.slice(index, index + 10);
    const results = await Promise.all(batch.map(async ({ id: businessId }) => {
      try {
        const result = await createBusinessNotification({
          businessId,
          eventKey: `admin-announcement:${announcement.id}`,
          category: "system",
          title: announcement.title,
          message: announcement.message,
          href: announcement.href,
          severity: "info",
          metadata: { announcementId: announcement.id },
        });
        return { count: result.notifications.length };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }));

    for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
      const result = results[resultIndex];
      if ("error" in result) {
        failures.push({ businessId: batch[resultIndex].id, error: result.error || "Unknown error" });
      } else {
        recipientCount += result.count;
      }
    }
  }

  const status = failures.length === 0 ? "sent" : recipientCount > 0 ? "partial" : "failed";
  const { error: finishError } = await supabase
    .from("notification_announcements")
    .update({
      status,
      recipient_count: recipientCount,
      error_details: failures,
      updated_at: new Date().toISOString(),
    })
    .eq("id", announcement.id);

  if (finishError) return { error: `Notifications were created but delivery status could not be saved: ${finishError.message}` };
  revalidatePath("/admin/notifications");
  revalidatePath("/dashboard", "layout");
  return failures.length > 0
    ? { error: `Announcement partially delivered to ${recipientCount} recipients; ${failures.length} businesses failed.` }
    : { success: true, recipientCount };
}

async function markAnnouncementFailed(
  supabase: ReturnType<typeof createServiceClient>,
  announcementId: string,
  errorMessage: string
) {
  const { error } = await supabase
    .from("notification_announcements")
    .update({
      status: "failed",
      error_details: [{ error: errorMessage }],
      updated_at: new Date().toISOString(),
    })
    .eq("id", announcementId);

  if (error) console.error("Failed to record announcement dispatch error:", error.message);
}
