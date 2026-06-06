"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentBusinessSetup } from "@/lib/queries/business";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { WelcomeEmail } from "@/lib/email/templates/welcome-email";
import { logErrorSync } from "@/lib/monitoring/log-error";

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
    return { error: validatedData.error.issues[0].message };
  }

  const data = validatedData.data;
  const supabase = await createClient();

  try {
    let businessId = setup.business?.id;
    let businessSlug = setup.business?.slug;

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
      businessSlug = slug;

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
      hosted_chat_enabled: true,
      hosted_chat_slug: setup.widgetConfig?.hosted_chat_slug || businessSlug,
      hosted_chat_title: `Chat with ${data.businessName}`,
      hosted_chat_description: "Ask a question, request support, or leave your details and the team will follow up.",
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

    // 4.5. Check Early Access slots limit for free accounts
    const hasExistingSub = setup.subscription && setup.subscription.plan === "free_trial" && setup.subscription.status === "active";
    if (!hasExistingSub) {
      const { count: activeFreeCount, error: countErr } = await supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("plan", "free_trial")
        .eq("status", "active");

      if (countErr) throw countErr;

      if ((activeFreeCount || 0) >= 50) {
        return { error: "Early access free slots are full. Please join the waitlist or choose a paid plan." };
      }
    }

    // 5. Upsert Subscription with full billing infrastructure
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const subscriptionData = {
      business_id: businessId,
      plan: "free_trial",
      status: "active",
      payment_provider: "manual",
      message_limit: 100,
      knowledge_limit: 5,
      lead_limit: 50,
      widget_limit: 1,
      embedding_limit: 1000,
      current_usage: 0,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      reset_date: periodEnd.toISOString(),
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

    // Send welcome email gracefully without blocking onboarding
    try {
      await sendTransactionalEmail({
        businessId: businessId,
        to: setup.user.email || data.contactEmail,
        subject: "Welcome to Agentify",
        templateName: "welcome-email",
        react: WelcomeEmail({
          businessName: data.businessName,
        }),
      });
    } catch (emailErr) {
      console.error("[ONBOARDING welcome email error]:", emailErr);
    }
    
    return { success: true };
  } catch (error: any) {
    logErrorSync(error, "onboarding");
    return { error: error.message || "Failed to complete onboarding" };
  }
}
