"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { getCurrentBusinessSetup } from "@/lib/queries/business";
import { resolveBusinessEntitlements } from "@/lib/billing/entitlements";
import { getUserBusinessRole } from "@/lib/team/permissions";
import { z } from "zod";

export async function updateProfileSettings(data: {
  full_name: string;
  email: string;
}) {
  try {
    const setup = await getCurrentBusinessSetup();
    if (!setup.user) throw new Error("Unauthorized");

    const supabase = await createClient();
    const fullName = data.full_name.trim();
    const email = data.email.trim();

    if (fullName.length < 3) {
      throw new Error("Full name must be at least 3 characters.");
    }
    if (!email.includes("@")) {
      throw new Error("Enter a valid email address.");
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", setup.user.id);

    if (profileError) throw profileError;

    const authUpdate: { email?: string; data: Record<string, string> } = {
      data: { full_name: fullName },
    };
    if (email !== setup.user.email) authUpdate.email = email;

    const { error: authError } = await supabase.auth.updateUser(authUpdate);
    if (authError) throw authError;

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to update personal info" };
  }
}

export async function updateNotificationSettings(data: {
  lead_email_alerts: boolean;
  conversation_email_alerts: boolean;
  billing_email_alerts: boolean;
  weekly_summary: boolean;
}) {
  try {
    const setup = await getCurrentBusinessSetup();
    if (!setup.user) throw new Error("Unauthorized");

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        ...setup.user.user_metadata,
        notification_settings: data,
      },
    });

    if (error) throw error;
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to update notifications" };
  }
}

export async function updateSecuritySettings(data: {
  current_password?: string;
  new_password: string;
  confirm_password: string;
}) {
  try {
    const setup = await getCurrentBusinessSetup();
    if (!setup.user) throw new Error("Unauthorized");

    if (data.new_password.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }
    if (data.new_password !== data.confirm_password) {
      throw new Error("New passwords do not match.");
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: data.new_password,
    });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to update password" };
  }
}

export async function updatePrivacySettings(data: {
  collect_leads: boolean;
  show_branding: boolean;
  is_enabled: boolean;
  allowed_domains: string[];
}) {
  try {
    const setup = await getCurrentBusinessSetup();
    if (!setup.user || !setup.business) throw new Error("No business found");

    const allowedDomains = data.allowed_domains
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);

    const entitlements = await resolveBusinessEntitlements(setup.business.id);
    const supabase = await createClient();
    const { error } = await supabase
      .from("widget_configs")
      .update({
        collect_leads: data.collect_leads,
        show_branding: !entitlements.canRemoveBranding,
        is_enabled: data.is_enabled,
        allowed_domains: allowedDomains,
      })
      .eq("business_id", setup.business.id);

    if (error) throw error;

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/widget");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to update privacy settings" };
  }
}

/**
 * Retrieves the notification preferences and business support email from Supabase.
 */
export async function getNotificationPreferences() {
  try {
    const setup = await getCurrentBusinessSetup();
    if (!setup.user || !setup.business) throw new Error("Unauthorized");

    const supabase = createServiceClient();
    const { data: rows, error } = await supabase
      .from("notification_preferences")
      .select("category, in_app_enabled, email_enabled")
      .eq("business_id", setup.business.id)
      .is("user_id", null);
    if (error) throw error;

    const byCategory = new Map((rows || []).map((row) => [row.category, row]));
    const preferences = {
      email_new_leads: byCategory.get("leads")?.email_enabled ?? true,
      email_booking_requests: byCategory.get("booking")?.email_enabled ?? true,
      email_support_requests: byCategory.get("support")?.email_enabled ?? true,
      email_usage_warnings: byCategory.get("usage")?.email_enabled ?? true,
      email_payment_updates: byCategory.get("billing")?.email_enabled ?? true,
      in_app_new_leads: byCategory.get("leads")?.in_app_enabled ?? true,
      in_app_booking_requests: byCategory.get("booking")?.in_app_enabled ?? true,
      in_app_support_requests: byCategory.get("support")?.in_app_enabled ?? true,
      in_app_usage_warnings: byCategory.get("usage")?.in_app_enabled ?? true,
      in_app_payment_updates: byCategory.get("billing")?.in_app_enabled ?? true,
    };

    return {
      preferences,
      supportEmail: setup.business.support_email || "",
      contactEmail: setup.business.contact_email || "",
    };
  } catch (err: any) {
    return { error: err?.message || "Failed to load notification settings" };
  }
}

/**
 * Saves the modified notification preferences and support email to Supabase.
 */
export async function saveNotificationPreferences(data: {
  email_new_leads: boolean;
  email_support_requests: boolean;
  email_booking_requests: boolean;
  email_usage_warnings: boolean;
  email_payment_updates: boolean;
  in_app_new_leads: boolean;
  in_app_support_requests: boolean;
  in_app_booking_requests: boolean;
  in_app_usage_warnings: boolean;
  in_app_payment_updates: boolean;
  support_email: string;
}) {
  try {
    const parsed = z.object({
      email_new_leads: z.boolean(),
      email_support_requests: z.boolean(),
      email_booking_requests: z.boolean(),
      email_usage_warnings: z.boolean(),
      email_payment_updates: z.boolean(),
      in_app_new_leads: z.boolean(),
      in_app_support_requests: z.boolean(),
      in_app_booking_requests: z.boolean(),
      in_app_usage_warnings: z.boolean(),
      in_app_payment_updates: z.boolean(),
      support_email: z.string().max(254),
    }).safeParse(data);
    if (!parsed.success) return { error: "Invalid notification settings." };
    const settings = parsed.data;

    const setup = await getCurrentBusinessSetup();
    if (!setup.user || !setup.business) throw new Error("Unauthorized");
    const role = await getUserBusinessRole(setup.user.id, setup.business.id);
    if (!role || !["owner", "admin"].includes(role)) {
      throw new Error("Only business owners and admins can update notification settings.");
    }

    const supabase = await createClient();
    const serviceClient = createServiceClient();

    // 1. Update support_email in businesses
    const supportEmail = settings.support_email.trim();
    if (supportEmail && !supportEmail.includes("@")) {
      throw new Error("Enter a valid support email address.");
    }

    const { error: bizError } = await supabase
      .from("businesses")
      .update({ support_email: supportEmail || null })
      .eq("id", setup.business.id);

    if (bizError) throw bizError;

    const preferenceRows = [
      ["leads", settings.email_new_leads, settings.in_app_new_leads],
      ["booking", settings.email_booking_requests, settings.in_app_booking_requests],
      ["support", settings.email_support_requests, settings.in_app_support_requests],
      ["usage", settings.email_usage_warnings, settings.in_app_usage_warnings],
      ["billing", settings.email_payment_updates, settings.in_app_payment_updates],
    ].map(([category, emailEnabled, inAppEnabled]) => ({
      business_id: setup.business!.id,
      user_id: null,
      category,
      email_enabled: emailEnabled,
      in_app_enabled: inAppEnabled,
      updated_at: new Date().toISOString(),
    }));

    const { error: prefsError } = await serviceClient
      .from("notification_preferences")
      .upsert(preferenceRows, { onConflict: "business_id,user_id,category" });

    if (prefsError) throw prefsError;

    revalidatePath("/dashboard/settings/notifications");
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to save notification settings" };
  }
}

/**
 * Dispatches a live test email using Resend to verify configuration.
 */
export async function sendTestEmailAction() {
  try {
    const setup = await getCurrentBusinessSetup();
    if (!setup.user || !setup.business) throw new Error("Unauthorized");

    const { sendTransactionalEmail } = await import("@/lib/email/send-email");
    const { WelcomeEmail } = await import("@/lib/email/templates/welcome-email");

    const { success, error } = await sendTransactionalEmail({
      businessId: setup.business.id,
      subject: "Test Email — Agentify Configuration Successful",
      templateName: "welcome-email",
      react: WelcomeEmail({
        businessName: setup.business.name,
      }),
    });

    if (!success) {
      throw new Error(error || "Resend delivery failed. Check your API key and sender domain settings.");
    }

    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Test email delivery failed." };
  }
}
