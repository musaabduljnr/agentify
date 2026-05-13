"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type OnboardingData = {
  // Step 1
  businessName: string;
  industry: string;
  websiteUrl: string;
  description: string;
  // Step 2
  contactEmail: string;
  phone: string;
  whatsapp: string;
  address: string;
  // Step 3
  assistantName: string;
  assistantTone: string;
  welcomeMessage: string;
  // Step 4
  primaryColor: string;
  position: string;
  suggestedQuestions: string[];
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function completeOnboarding(data: OnboardingData) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const slugBase = generateSlug(data.businessName);
  const slug = `${slugBase}-${Math.random().toString(36).substring(2, 7)}`;

  // Using a transaction-like approach (Supabase doesn't have multi-table transactions in a single RPC easily without a custom function, but we can do it sequentially)
  // For production, a stored procedure would be better, but we'll do it here for clarity.

  // 1. Create Business
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .insert({
      owner_id: user.id,
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

  if (bizError) {
    console.error("Business creation error:", bizError);
    return { error: bizError.message };
  }

  // 2. Create Assistant
  const { error: asstError } = await supabase.from("assistants").insert({
    business_id: business.id,
    name: data.assistantName,
    tone: data.assistantTone,
    welcome_message: data.welcomeMessage,
  });

  if (asstError) return { error: asstError.message };

  // 3. Create Widget Config
  const { error: widgetError } = await supabase.from("widget_configs").insert({
    business_id: business.id,
    primary_color: data.primaryColor,
    position: data.position,
    suggested_questions: data.suggestedQuestions,
  });

  if (widgetError) return { error: widgetError.message };

  // 4. Create Default Subscription
  const { error: subError } = await supabase.from("subscriptions").insert({
    business_id: business.id,
    plan: "free",
    status: "active",
    message_limit: 100,
  });

  if (subError) return { error: subError.message };

  revalidatePath("/", "layout");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
