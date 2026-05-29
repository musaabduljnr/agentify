"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { getCurrentBusinessSetup } from "@/lib/queries/business";

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

    const supabase = await createClient();
    const { error } = await supabase
      .from("widget_configs")
      .update({
        collect_leads: data.collect_leads,
        show_branding: data.show_branding,
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
    
    // 1. Fetch preferences
    let { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("business_id", setup.business.id)
      .maybeSingle();

    // 2. If missing, initialize defaults
    if (!prefs) {
      const { data: newPrefs, error: insertErr } = await supabase
        .from("notification_preferences")
        .insert({ business_id: setup.business.id })
        .select()
        .single();
        
      if (insertErr) throw insertErr;
      prefs = newPrefs;
    }

    return {
      preferences: prefs,
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
  support_email: string;
}) {
  try {
    const setup = await getCurrentBusinessSetup();
    if (!setup.user || !setup.business) throw new Error("Unauthorized");

    const supabase = await createClient();
    const serviceClient = createServiceClient();

    // 1. Update support_email in businesses
    const supportEmail = data.support_email.trim();
    if (supportEmail && !supportEmail.includes("@")) {
      throw new Error("Enter a valid support email address.");
    }

    const { error: bizError } = await supabase
      .from("businesses")
      .update({ support_email: supportEmail || null })
      .eq("id", setup.business.id);

    if (bizError) throw bizError;

    // 2. Update notification_preferences
    const { error: prefsError } = await serviceClient
      .from("notification_preferences")
      .upsert(
        {
          business_id: setup.business.id,
          email_new_leads: data.email_new_leads,
          email_support_requests: data.email_support_requests,
          email_booking_requests: data.email_booking_requests,
          email_usage_warnings: data.email_usage_warnings,
          email_payment_updates: data.email_payment_updates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

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
