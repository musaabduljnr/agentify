"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { generateEmbedding } from "@/lib/vertex/embeddings";
import { generateGeminiResponse } from "@/lib/vertex/gemini";
import { buildBusinessPrompt } from "@/lib/ai/build-business-prompt";

export async function getCurrentBusiness() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (error || !business) throw new Error("No business found");
  return business;
}

export async function getAssistant(businessId: string) {
  const supabase = await createClient();
  const { data: assistant, error } = await supabase
    .from("assistants")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .single();

  if (error || !assistant) return null;
  return assistant;
}

export async function sendDashboardTestMessage({
  message,
  conversationId,
}: {
  message: string;
  conversationId?: string;
}) {
  try {
    const business = await getCurrentBusiness();
    const assistant = await getAssistant(business.id);
    
    if (!assistant) {
      throw new Error("No active AI assistant found for your business. Please complete the assistant setup.");
    }

    const supabase = await createClient();
    let currentConversationId = conversationId;

    // 1. Create conversation if not exists
    if (!currentConversationId) {
      const { data: conv, error: convError } = await supabase
        .from("conversations")
        .insert({
          business_id: business.id,
          source: "dashboard_test",
          status: "open",
          visitor_name: "Dashboard Tester",
        })
        .select()
        .single();

      if (convError) throw new Error(`Failed to create conversation: ${convError.message}`);
      currentConversationId = conv.id;
    }

    // 2. Save user message
    const { error: userMsgError } = await supabase.from("messages").insert({
      conversation_id: currentConversationId,
      business_id: business.id,
      role: "user",
      content: message,
    });

    if (userMsgError) throw new Error(`Failed to save user message: ${userMsgError.message}`);

    // 3. RAG: Search knowledge base
    const queryEmbedding = await generateEmbedding(message);
    const { data: matchedChunks, error: rpcError } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: queryEmbedding,
      match_business_id: business.id,
      match_count: 5,
    });

    if (rpcError) throw new Error(`Knowledge search failed: ${rpcError.message}`);

    // 4. Build Prompt & Generate AI Response
    const systemPrompt = buildBusinessPrompt({
      business,
      assistant,
      contextChunks: matchedChunks || [],
    });

    const assistantResponse = await generateGeminiResponse({
      systemInstruction: systemPrompt,
      userMessage: message,
      temperature: Number(assistant.temperature) || 0.4,
    });

    // 5. Save assistant message
    const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: currentConversationId,
        business_id: business.id,
        role: "assistant",
        content: assistantResponse,
        retrieved_chunks: matchedChunks || [],
      })
      .select()
      .single();

    if (assistantMsgError) throw new Error(`Failed to save assistant response: ${assistantMsgError.message}`);

    revalidatePath("/dashboard/playground");
    revalidatePath("/dashboard/conversations");

    return {
      success: true,
      conversationId: currentConversationId,
      assistantMessage: savedAssistantMsg,
      retrievedChunks: matchedChunks || [],
    };
  } catch (err: any) {
    console.error("Chat Action Error:", err);
    return { error: err.message || "An error occurred during chat processing." };
  }
}

export async function getDashboardConversation(conversationId: string) {
  const business = await getCurrentBusiness();
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
