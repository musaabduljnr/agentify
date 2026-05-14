"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentBusinessSetup } from "@/lib/queries/business";

export async function repairCurrentBusinessSetup() {
  const setup = await getCurrentBusinessSetup();
  
  if (!setup.user) {
    throw new Error("Unauthorized");
  }

  if (!setup.business) {
    return { error: "No business found. Please complete onboarding." };
  }

  const supabase = await createClient();
  const businessId = setup.business.id;

  try {
    // 1. Repair Assistant
    if (!setup.assistant) {
      const { error: asstError } = await supabase.from("assistants").insert({
        business_id: businessId,
        name: `${setup.business.name} Assistant`,
        tone: "Friendly",
        welcome_message: "Hello! I'm your AI assistant. How can I help you today?",
        system_prompt: `You are an AI assistant for ${setup.business.name}.`,
        model: "gemini-2.5-flash",
        temperature: 0.4,
        is_active: true,
      });
      if (asstError) throw asstError;
    }

    // 2. Repair Widget Config
    if (!setup.widgetConfig) {
      const { error: widgetError } = await supabase.from("widget_configs").insert({
        business_id: businessId,
        primary_color: "#4f46e5",
        position: "bottom-right",
        welcome_text: "Hello! How can we help you today?",
        suggested_questions: ["How much does it cost?", "What are your hours?"],
        show_branding: true,
        is_enabled: true,
        collect_leads: true,
      });
      if (widgetError) throw widgetError;
    }

    // 3. Repair Subscription
    if (!setup.subscription) {
      const { error: subError } = await supabase.from("subscriptions").insert({
        business_id: businessId,
        plan: "free_trial",
        status: "active",
        message_limit: 100,
        current_usage: 0,
      });
      if (subError) throw subError;
    }

    // 4. Finalize Business
    if (!setup.business.onboarding_completed) {
      const { error: bizError } = await supabase
        .from("businesses")
        .update({ onboarding_completed: true })
        .eq("id", businessId);
      if (bizError) throw bizError;
    }

    revalidatePath("/", "layout");
    revalidatePath("/dashboard", "layout");

    return { success: true };
  } catch (error: any) {
    console.error("Repair error:", error);
    return { error: error.message || "Failed to repair setup" };
  }
}
