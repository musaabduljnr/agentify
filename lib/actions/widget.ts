"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/queries/business";

const widgetConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  position: z.enum(["bottom-right", "bottom-left"]),
  welcomeText: z.string().trim().min(1, "Welcome text is required").max(500),
  suggestedQuestions: z.array(z.string().trim().min(1).max(160)).max(8),
  showBranding: z.boolean().default(true),
  isEnabled: z.boolean().default(true),
  collectLeads: z.boolean().default(true),
  hostedChatEnabled: z.boolean().default(true),
  hostedChatSlug: z.string()
    .trim()
    .toLowerCase()
    .min(3, "Hosted chat slug must be at least 3 characters")
    .max(80, "Hosted chat slug is too long")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  hostedChatTitle: z.string().trim().max(120, "Page title is too long").optional().default(""),
  hostedChatDescription: z.string().trim().max(240, "Page description is too long").optional().default(""),
  allowedDomains: z.array(
    z.string()
      .trim()
      .toLowerCase()
      .regex(/^(?!https?:\/\/)(?!localhost$)(?!127\.0\.0\.1$)([a-z0-9-]+\.)+[a-z]{2,}$/i, "Enter domains only, such as example.com")
  ).max(20).default([]),
});

export type WidgetConfigData = z.infer<typeof widgetConfigSchema>;

export async function updateWidgetConfig(data: WidgetConfigData) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("Unauthorized");

    const validatedData = widgetConfigSchema.safeParse(data);
    if (!validatedData.success) {
      return { error: validatedData.error.issues[0].message };
    }

    const supabase = await createClient();

    const { data: existingSlug, error: slugError } = await supabase
      .from("widget_configs")
      .select("business_id")
      .eq("hosted_chat_slug", validatedData.data.hostedChatSlug)
      .neq("business_id", business.id)
      .maybeSingle();

    if (slugError) throw slugError;
    if (existingSlug) {
      return { error: "That hosted chat slug is already taken." };
    }

    const { error } = await supabase
      .from("widget_configs")
      .update({
        primary_color: validatedData.data.primaryColor,
        position: validatedData.data.position,
        welcome_text: validatedData.data.welcomeText,
        suggested_questions: validatedData.data.suggestedQuestions,
        show_branding: validatedData.data.showBranding,
        is_enabled: validatedData.data.isEnabled,
        collect_leads: validatedData.data.collectLeads,
        hosted_chat_enabled: validatedData.data.hostedChatEnabled,
        hosted_chat_slug: validatedData.data.hostedChatSlug,
        hosted_chat_title: validatedData.data.hostedChatTitle || null,
        hosted_chat_description: validatedData.data.hostedChatDescription || null,
        allowed_domains: validatedData.data.allowedDomains,
      })
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath("/dashboard/widget");
    revalidatePath("/dashboard/embed");
    revalidatePath(`/chat/${validatedData.data.hostedChatSlug}`);
    return { success: true };
  } catch (error: any) {
    console.error("Widget config error:", error);
    return { error: error.message || "Failed to update widget configuration" };
  }
}

export async function getWidgetConfig() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("widget_configs")
      .select("*")
      .eq("business_id", business.id)
      .maybeSingle();

    if (error) throw error;
    return {
      ...data,
      hosted_chat_slug: data?.hosted_chat_slug || business.slug,
    };
  } catch (error) {
    console.error("Fetch widget config error:", error);
    return null;
  }
}
