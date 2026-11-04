"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/security/rate-limit";
import { requireCompleteBusinessSetup } from "@/lib/queries/business";
import {
  completeUsageQuota,
  getQuotaDenialMessage,
  releaseUsageQuota,
  reserveUsageQuota,
} from "@/lib/billing/usage";
import { requireBusinessEntitlement } from "@/lib/billing/entitlements";
import { runBusinessChat } from "./chat/run-business-chat";

export async function getCurrentBusiness() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (error || !business) return null;
  return business;
}

export async function getAssistant(businessId: string) {
  const supabase = await createClient();
  const { data: assistant, error } = await supabase
    .from("assistants")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();

  return assistant;
}

export async function updateAssistant(data: {
  id?: string;
  name: string;
  tone: string;
  welcome_message: string;
  business_description?: string;
}) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");
    await requireBusinessEntitlement(business.id, "canCreateAssistant");

    const supabase = await createClient();

    if (data.business_description) {
      await supabase
        .from("businesses")
        .update({ description: data.business_description })
        .eq("id", business.id);
    }

    if (data.id) {
      const { error } = await supabase
        .from("assistants")
        .update({
          name: data.name,
          tone: data.tone,
          welcome_message: data.welcome_message,
        })
        .eq("id", data.id)
        .eq("business_id", business.id);

      if (error) throw new Error(error.message);
    } else {
      const { reservation } = await reserveUsageQuota(business.id, "assistant", 1);
      if (!reservation) {
        return {
          error: "You've reached the maximum number of assistants allowed under your current plan. Please upgrade to create more."
        };
      }

      const { error } = await supabase.from("assistants").insert({
        business_id: business.id,
        name: data.name,
        tone: data.tone,
        welcome_message: data.welcome_message,
      });

      if (error) {
        await releaseUsageQuota(reservation);
        throw new Error(error.message);
      }
      await completeUsageQuota(reservation);
    }

    revalidatePath("/dashboard/assistant");
    revalidatePath("/dashboard/playground");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update assistant" };
  }
}

export async function updateBusinessSettings(data: {
  name: string;
  website_url: string;
  contact_email: string;
  phone: string;
  address: string;
  industry?: string;
  description?: string;
}) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");

    const supabase = await createClient();

    const { error } = await supabase
      .from("businesses")
      .update({
        name: data.name,
        website_url: data.website_url,
        contact_email: data.contact_email,
        phone: data.phone,
        address: data.address,
        industry: data.industry,
        description: data.description,
      })
      .eq("id", business.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update business settings" };
  }
}

export async function sendDashboardTestMessage({
  message,
  conversationId,
}: {
  message: string;
  conversationId?: string;
}) {
  try {
    const setup = await requireCompleteBusinessSetup();
    const { business } = setup;

    const rateLimitResult = await rateLimit(setup.user.id, "playground_chat");
    if (!rateLimitResult.success) {
      return { error: "Too many AI playground messages. Please slow down and try again later." };
    }
    
    const result = await runBusinessChat({
      message,
      businessId: business.id,
      conversationId,
      source: "dashboard_test",
    });

    revalidatePath("/dashboard/playground");
    revalidatePath("/dashboard/conversations");

    return {
      ...result,
      retrievedChunks: result.assistantMessage?.retrieved_chunks || [],
    };
  } catch (err: any) {
    console.error("Error in sendDashboardTestMessage:", err);
    return { error: err.message || "Failed to send test message." };
  }
}

export async function deleteAssistant(id: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");

    const supabase = await createClient();

    const { data: assistant } = await supabase
      .from("assistants")
      .select("is_active")
      .eq("id", id)
      .eq("business_id", business.id)
      .single();

    if (assistant?.is_active) {
      throw new Error("You cannot delete your active assistant. Set another assistant as active first.");
    }

    const { error } = await supabase
      .from("assistants")
      .delete()
      .eq("id", id)
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath("/dashboard/assistant");
    revalidatePath("/dashboard/playground");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteAssistant:", err);
    return { error: err.message || "Failed to delete assistant" };
  }
}

export async function setActiveAssistant(assistantId: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");
    await requireBusinessEntitlement(business.id, "canCreateAssistant");

    const supabase = await createClient();

    const { error: rpcError } = await supabase.rpc("set_active_assistant", {
      p_business_id: business.id,
      p_assistant_id: assistantId,
    });

    if (rpcError) throw rpcError;

    revalidatePath("/dashboard/assistant");
    revalidatePath("/dashboard/playground");
    return { success: true };
  } catch (err: any) {
    console.error("Error in setActiveAssistant:", err);
    return { error: err.message || "Failed to activate assistant" };
  }
}

export async function getDashboardConversation(conversationId: string) {
  const business = await getCurrentBusiness();
  if (!business) throw new Error("No business found");
  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("business_id", business.id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return messages;
}

export async function getBusinessConversations() {
  const business = await getCurrentBusiness();
  if (!business) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(`
      *,
      messages:messages(content, created_at)
    `)
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  
  return data.map((conv: any) => {
    const sortedMessages = [...(conv.messages || [])].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return {
      ...conv,
      last_message: sortedMessages[sortedMessages.length - 1] || null
    };
  });
}

export async function toggleManualTakeover({
  conversationId,
  isManual,
}: {
  conversationId: string;
  isManual: boolean;
}) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");
    const supabase = await createClient();

    const { data: conv, error: fetchErr } = await supabase
      .from("conversations")
      .select("metadata")
      .eq("id", conversationId)
      .eq("business_id", business.id)
      .single();

    if (fetchErr) throw fetchErr;

    const currentMetadata = conv?.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      is_manual_takeover: isManual,
    };

    try {
      const { error: primaryError } = await supabase
        .from("conversations")
        .update({ 
          is_manual_takeover: isManual,
          metadata: updatedMetadata
        })
        .eq("id", conversationId)
        .eq("business_id", business.id);

      if (primaryError) {
        if (primaryError.message?.includes("is_manual_takeover") || primaryError.code === "42703") {
          const { error: fallbackError } = await supabase
            .from("conversations")
            .update({ metadata: updatedMetadata })
            .eq("id", conversationId)
            .eq("business_id", business.id);
          
          if (fallbackError) throw fallbackError;
        } else {
          throw primaryError;
        }
      }
    } catch (dbErr) {
      const { error: fallbackError } = await supabase
        .from("conversations")
        .update({ metadata: updatedMetadata })
        .eq("id", conversationId)
        .eq("business_id", business.id);
      
      if (fallbackError) throw fallbackError;
    }

    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to toggle manual takeover" };
  }
}

export async function sendManualMessage({
  conversationId,
  content,
}: {
  conversationId: string;
  content: string;
}) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");
    const supabase = await createClient();

    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("business_id", business.id)
      .single();

    if (convErr || !conv) throw new Error("Conversation not found");

    const { error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        business_id: business.id,
        role: "assistant",
        content,
        metadata: { is_manual: true },
      });

    if (msgErr) throw msgErr;

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to send manual message" };
  }
}

export async function getAssistants() {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");

    const supabase = await createClient();
    const { data: assistants, error } = await supabase
      .from("assistants")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return assistants || [];
  } catch (err: any) {
    console.error("Error in getAssistants:", err);
    throw err;
  }
}

export async function createAssistant(data: {
  name: string;
  tone: string;
  welcome_message: string;
}) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");
    await requireBusinessEntitlement(business.id, "canCreateAssistant");

    const supabase = await createClient();
    const { reservation, reason } = await reserveUsageQuota(business.id, "assistant", 1);
    if (!reservation) {
      return { error: getQuotaDenialMessage(reason, "assistant") };
    }

    const { data: newAsst, error } = await supabase
      .from("assistants")
      .insert({
        business_id: business.id,
        name: data.name,
        tone: data.tone,
        welcome_message: data.welcome_message,
        is_active: false,
      })
      .select()
      .single();

    if (error) {
      await releaseUsageQuota(reservation);
      throw error;
    }
    await completeUsageQuota(reservation);

    revalidatePath("/dashboard/assistant");
    return { success: true, assistant: newAsst };
  } catch (err: any) {
    console.error("Error in createAssistant:", err);
    return { error: err.message || "Failed to create assistant" };
  }
}
