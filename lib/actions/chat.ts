"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { retrieveBusinessContext } from "@/lib/ai/rag/retrieve-context";
import { getRecentConversationMessages } from "@/lib/ai/memory/message-history";
import { summarizeConversationIfNeeded } from "@/lib/ai/memory/conversation-summary";
import { type FeatureSource } from "@/lib/ai/logs/ai-logs";
import { rateLimit } from "@/lib/security/rate-limit";
import { requireCompleteBusinessSetup } from "@/lib/queries/business";
import { verifyAIUsageLimits } from "@/lib/billing/usage";

// Import modular sub-handlers
import { resolveOrCreateConversation } from "./chat/conversation-management";
import { saveUserMessage, saveAssistantMessage } from "./chat/message-persistence";
import { processLeadHandling } from "./chat/lead-handling";
import { getAiResponse } from "./chat/ai-response";
import { processUsageTracking } from "./chat/usage-tracking";

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
      const { error } = await supabase.from("assistants").insert({
        business_id: business.id,
        name: data.name,
        tone: data.tone,
        welcome_message: data.welcome_message,
      });

      if (error) throw new Error(error.message);
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

export async function runBusinessChat({
  message,
  businessId,
  conversationId,
  visitorId,
  source = "widget",
  isDemo = false,
  demoBusinessId,
  featureSource,
}: {
  message: string;
  businessId: string;
  conversationId?: string;
  visitorId?: string;
  source?: string;
  isDemo?: boolean;
  demoBusinessId?: string;
  featureSource?: FeatureSource;
}) {
  const supabase = createServiceClient();
  const computedFeatureSource = featureSource || (
    isDemo 
      ? "demo_generation" 
      : (source === "dashboard_test" || source === "playground" ? "playground" : "hosted_chat")
  );

  // 1. Authorization & Expiry Validation
  if (isDemo) {
    if (!demoBusinessId) {
      throw new Error("Missing demoBusinessId for demo chat session.");
    }
    const { data: demo, error: demoErr } = await supabase
      .from("demo_businesses")
      .select("*")
      .eq("id", demoBusinessId)
      .single();

    if (demoErr || !demo) {
      throw new Error("Demo assistant not found.");
    }
    if (demo.status !== "active") {
      throw new Error(`This demo assistant is currently ${demo.status}.`);
    }
    const isExpired = new Date(demo.expires_at) < new Date();
    if (isExpired) {
      await supabase
        .from("demo_businesses")
        .update({ status: "expired" })
        .eq("id", demoBusinessId);
      throw new Error("This demo assistant has expired.");
    }
  } else {
    const checkResult = await verifyAIUsageLimits(businessId);
    if (!checkResult.allowed) {
      return {
        success: false,
        conversationId: conversationId || "",
        reply: checkResult.message || "Usage limit reached.",
        assistantMessage: null,
        limitReached: true,
      };
    }
  }

  // 2. Fetch Business & Assistant Details
  const { data: business, error: bErr } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();
  
  if (bErr || !business) throw new Error("Business not found");

  const { data: assistant, error: aErr } = await supabase
    .from("assistants")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .single();

  if (aErr || !assistant) throw new Error("Assistant not found");

  const usageType = source === "widget" ? "widget_chat" as const : "message" as const;

  // 3. Resolve or Create Conversation (extracted)
  const { conversationId: currentConversationId, conversation } = await resolveOrCreateConversation({
    currentConversationId: conversationId,
    businessId,
    visitorId,
    source,
    isDemo,
    demoBusinessId,
    message,
  });

  // 4. Save User Message (extracted)
  await saveUserMessage({
    conversationId: currentConversationId!,
    businessId,
    message,
  });

  // Check manual takeover
  const isManualTakeover = conversation?.is_manual_takeover || conversation?.metadata?.is_manual_takeover === true;
  if (isManualTakeover) {
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", currentConversationId!);

    return {
      success: true,
      conversationId: currentConversationId!,
      reply: null,
      assistantMessage: null,
      isManualTakeover: true,
    };
  }

  // 5. RAG Context Retrieval
  const isContinuation = message.toLowerCase().trim() === "continue";
  let ragQuery = message;

  if (isContinuation && currentConversationId) {
    const { data: recentMsgs } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", currentConversationId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (recentMsgs && recentMsgs.length >= 3) {
      if (recentMsgs[2].role === "user") {
        ragQuery = recentMsgs[2].content;
      }
    }
  }

  const { chunks, formattedContext, intent } = await retrieveBusinessContext({
    businessId,
    query: ragQuery,
    matchCount: 5,
    minSimilarity: 0.55,
    featureSource: computedFeatureSource,
  });

  // 6. Lead intelligence & Contact Extraction (extracted)
  const leadResult = await processLeadHandling({
    message,
    businessId,
    conversationId: currentConversationId!,
    visitorId,
    source,
    isDemo,
    demoBusinessId,
    businessName: business.name,
    conversation,
  });

  // 7. Conversation Summary & Memory History
  const summary = await summarizeConversationIfNeeded(currentConversationId!, businessId, computedFeatureSource);
  const history = await getRecentConversationMessages(currentConversationId!, 4);

  // 8. Generate Prompt & Call AI Engine (extracted)
  const { finalReply, chatResponse, cachedAnswer } = await getAiResponse({
    message,
    businessId,
    conversationId: currentConversationId!,
    isDemo,
    business,
    assistant,
    formattedContext,
    metadata: leadResult.metadata,
    summary,
    history,
    computedFeatureSource,
  });

  // 9. Save Assistant Response (extracted)
  const savedAssistantMsg = await saveAssistantMessage({
    conversationId: currentConversationId!,
    businessId,
    content: finalReply,
    chunks,
    intent,
    cachedAnswer,
    chatResponse,
  });

  // 10. Usage Increments (extracted)
  if (!isDemo) {
    await processUsageTracking({
      businessId,
      conversationId: currentConversationId!,
      source,
      usageType,
      cachedAnswer,
      businessName: business.name,
    });
  }

  return {
    success: true,
    conversationId: currentConversationId!,
    reply: finalReply,
    assistantMessage: savedAssistantMsg,
    intent,
    latencyMs: chatResponse?.latencyMs || 0,
  };
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

    const supabase = await createClient();

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("widget_limit")
      .eq("business_id", business.id)
      .maybeSingle();

    const limit = sub?.widget_limit || 1;

    const { count, error: countErr } = await supabase
      .from("assistants")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id);

    if (countErr) throw countErr;

    if ((count || 0) >= limit) {
      return { error: `You've reached the maximum number of assistants (${limit}) allowed under your current plan. Please upgrade to create more.` };
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

    if (error) throw error;

    revalidatePath("/dashboard/assistant");
    return { success: true, assistant: newAsst };
  } catch (err: any) {
    console.error("Error in createAssistant:", err);
    return { error: err.message || "Failed to create assistant" };
  }
}
