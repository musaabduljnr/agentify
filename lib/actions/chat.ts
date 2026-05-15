"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { generateEmbedding } from "@/lib/vertex/embeddings";
import { generateGeminiResponse } from "@/lib/vertex/gemini";
import { buildBusinessPrompt } from "@/lib/ai/build-business-prompt";
import { requireCompleteBusinessSetup } from "@/lib/queries/business";

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

    // Also update business description if provided
    if (data.business_description) {
      await supabase
        .from("businesses")
        .update({ description: data.business_description })
        .eq("id", business.id);
    }

    if (data.id) {
      // Update existing
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
      // Create new
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
}: {
  message: string;
  businessId: string;
  conversationId?: string;
  visitorId?: string;
  source?: string;
}) {
  const supabase = createServiceClient();

  // 1. Fetch business and assistant
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

  let currentConversationId = conversationId;

  // 2. Create/Fetch conversation
  if (!currentConversationId) {
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({
        business_id: businessId,
        source: source,
        status: "open",
        visitor_id: visitorId,
      })
      .select()
      .single();

    if (convError) throw new Error(`Failed to create conversation: ${convError.message}`);
    currentConversationId = conv.id;
  }

  // 3. Save user message
  const { error: userMsgError } = await supabase.from("messages").insert({
    conversation_id: currentConversationId,
    business_id: businessId,
    role: "user",
    content: message,
  });

  if (userMsgError) throw new Error(`Failed to save user message: ${userMsgError.message}`);

  // 4. RAG: Search knowledge base
  const queryEmbedding = await generateEmbedding(message);
  const { data: matchedChunks, error: rpcError } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    match_business_id: businessId,
    match_count: 5,
  });

  if (rpcError) throw new Error(`Knowledge search failed: ${rpcError.message}`);

  // 5. Fetch Conversation History
  const { data: historyMsgs } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", currentConversationId)
    .order("created_at", { ascending: true }) // chronological order
    .limit(20);

  const history = (historyMsgs || [])
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      content: m.content
    }));

  // 6. Build Prompt & Generate AI Response
  const systemPrompt = buildBusinessPrompt({
    business,
    assistant,
    contextChunks: matchedChunks || [],
  });

  const assistantResponse = await generateGeminiResponse({
    systemInstruction: systemPrompt,
    userMessage: message,
    history: history,
    temperature: Number(assistant.temperature) || 0.4,
  });

  // 6. Save assistant message
  const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: currentConversationId,
      business_id: businessId,
      role: "assistant",
      content: assistantResponse,
      retrieved_chunks: matchedChunks || [],
    })
    .select()
    .single();

  if (assistantMsgError) throw new Error(`Failed to save assistant response: ${assistantMsgError.message}`);

  return {
    success: true,
    conversationId: currentConversationId,
    reply: assistantResponse,
    assistantMessage: savedAssistantMsg,
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
      retrievedChunks: result.assistantMessage.retrieved_chunks,
    };
  } catch (err: any) {
    console.error("Chat Action Error:", err);
    return { error: err.message || "An error occurred during chat processing." };
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
  
  // Transform to include last message
  return data.map((conv: any) => ({
    ...conv,
    last_message: conv.messages?.[conv.messages.length - 1] || null
  }));
}
