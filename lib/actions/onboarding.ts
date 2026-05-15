"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentBusinessSetup } from "@/lib/queries/business";

const onboardingSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  industry: z.string().min(2, "Industry is required"),
  websiteUrl: z.string().url("Invalid website URL").or(z.literal("")),
  description: z.string().min(10, "Please provide a more detailed description"),
  contactEmail: z.string().email("Invalid contact email"),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  assistantName: z.string().min(2, "Assistant name is required"),
  assistantTone: z.string().min(2, "Tone is required"),
  welcomeMessage: z.string().min(5, "Welcome message is required"),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  position: z.enum(["bottom-right", "bottom-left"]),
  suggestedQuestions: z.array(z.string()).optional(),
});

export type OnboardingData = z.infer<typeof onboardingSchema>;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function completeOnboarding(rawData: OnboardingData) {
  const setup = await getCurrentBusinessSetup();
  if (!setup.user) {
    throw new Error("Unauthorized");
  }

  // 1. Validate data
  const validatedData = onboardingSchema.safeParse(rawData);
  if (!validatedData.success) {
    return { error: validatedData.error.errors[0].message };
  }

  const data = validatedData.data;
  const supabase = await createClient();

  try {
    let businessId = setup.business?.id;

    // 2. Upsert Business
    if (setup.business) {
      const { error: bizError } = await supabase
        .from("businesses")
        .update({
          name: data.businessName,
          industry: data.industry,
          website_url: data.websiteUrl,
          description: data.description,
          contact_email: data.contactEmail,
          phone: data.phone,
          whatsapp: data.whatsapp,
          address: data.address,
          onboarding_completed: true,
        })
        .eq("id", setup.business.id);

      if (bizError) throw bizError;
    } else {
      const slugBase = generateSlug(data.businessName);
      const slug = `${slugBase}-${Math.random().toString(36).substring(2, 7)}`;

      const { data: newBiz, error: bizError } = await supabase
        .from("businesses")
        .insert({
          owner_id: setup.user.id,
          name: data.businessName,
          slug: slug,
          industry: data.industry,
          website_url: data.websiteUrl,
          description: data.description,
          contact_email: data.contactEmail,
          phone: data.phone,
          whatsapp: data.whatsapp,
          address: data.address,
          onboarding_completed: true,
        })
        .select()
        .single();

      if (bizError) throw bizError;
      businessId = newBiz.id;
    }

    if (!businessId) throw new Error("Failed to resolve business ID");

    // 3. Upsert Assistant
    const assistantData = {
      business_id: businessId,
      name: data.assistantName,
      tone: data.assistantTone,
      welcome_message: data.welcomeMessage,
      system_prompt: `You are ${data.assistantName}, a ${data.assistantTone} AI assistant for ${data.businessName}. 
Business Description: ${data.description}
Industry: ${data.industry}
Your goal is to help visitors and collect leads.`,
      model: "gemini-1.5-flash",
      temperature: 0.4,
      is_active: true,
    };

    if (setup.assistant) {
      const { error: asstError } = await supabase
        .from("assistants")
        .update(assistantData)
        .eq("id", setup.assistant.id);
      if (asstError) throw asstError;
    } else {
      const { error: asstError } = await supabase
        .from("assistants")
        .insert(assistantData);
      if (asstError) throw asstError;
    }

    // 4. Upsert Widget Config
    const widgetData = {
      business_id: businessId,
      primary_color: data.primaryColor,
      position: data.position,
      welcome_text: data.welcomeMessage,
      suggested_questions: data.suggestedQuestions || [],
      show_branding: true,
      is_enabled: true,
      collect_leads: true,
    };

    if (setup.widgetConfig) {
      const { error: widgetError } = await supabase
        .from("widget_configs")
        .update(widgetData)
        .eq("id", setup.widgetConfig.id);
      if (widgetError) throw widgetError;
    } else {
      const { error: widgetError } = await supabase
        .from("widget_configs")
        .insert(widgetData);
      if (widgetError) throw widgetError;
    }

    // 5. Upsert Subscription
    const subscriptionData = {
      business_id: businessId,
      plan: "free_trial",
      status: "active",
      message_limit: 100,
      current_usage: 0,
    };

    if (setup.subscription) {
      const { error: subError } = await supabase
        .from("subscriptions")
        .update(subscriptionData)
        .eq("id", setup.subscription.id);
      if (subError) throw subError;
    } else {
      const { error: subError } = await supabase
        .from("subscriptions")
        .insert(subscriptionData);
      if (subError) throw subError;
    }

    revalidatePath("/", "layout");
    revalidatePath("/dashboard", "layout");
    
    return { success: true };
  } catch (error: any) {
    console.error("Onboarding error:", error);
    return { error: error.message || "Failed to complete onboarding" };
  }
}
