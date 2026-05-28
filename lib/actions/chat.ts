"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { generateEmbedding } from "@/lib/vertex/embeddings";
import { generateGeminiResponse } from "@/lib/vertex/gemini";
import { buildBusinessPrompt } from "@/lib/ai/build-business-prompt";
import { requireCompleteBusinessSetup } from "@/lib/queries/business";
import { 
  detectLeadIntent, 
  extractLeadInfo, 
  detectConversationIntent 
} from "@/lib/ai/lead-detection";
import { checkUsageLimit, incrementUsage } from "@/lib/billing/usage";
import { requireActiveSubscription } from "@/lib/billing/subscription";
import { rateLimit } from "@/lib/security/rate-limit";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";
import { sendLeadNotificationEmail, sendUsageWarningEmail } from "@/lib/email/resend";

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

  // 0. Enforce subscription and load business context.
  try {
    await requireActiveSubscription(businessId);
  } catch (e: any) {
    return {
      success: false,
      conversationId: conversationId || "",
      reply: e.message || "Your subscription is not active. Please update your billing to continue.",
      assistantMessage: null,
      limitReached: true,
    };
  }

  const { data: business, error: bErr } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();
  
  if (bErr || !business) throw new Error("Business not found");

  const usageType = source === "widget" ? "widget_chat" as const : "message" as const;
  const usageCheck = await checkUsageLimit(businessId, usageType);
  if (!usageCheck.allowed) {
    await sendUsageWarningEmail({
      to: business.contact_email,
      businessId,
      label: "AI messages",
      used: usageCheck.used,
      limit: usageCheck.limit,
    });

    return {
      success: false,
      conversationId: conversationId || "",
      reply: "You've reached your monthly AI message limit. Please upgrade your plan to continue.",
      assistantMessage: null,
      limitReached: true,
    };
  }

  const { data: assistant, error: aErr } = await supabase
    .from("assistants")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .single();

  if (aErr || !assistant) throw new Error("Assistant not found");

  let currentConversationId = conversationId;
  let conversation: any = null;

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
    conversation = conv;
  } else {
    const { data: existingConversation, error: existingConversationError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", currentConversationId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (existingConversationError || !existingConversation) {
      throw new Error("Conversation not found for this business.");
    }
    conversation = existingConversation;
  }

  // 2.1 Lead Intelligence & Capture
  const metadata = (conversation?.metadata as any) || {};
  const hasBuyingIntent = detectLeadIntent(message);
  const { intentType, requestedAction } = detectConversationIntent(message);
  const extractedInfo = extractLeadInfo(message);

  let contactRequested = metadata.contact_requested || false;
  let contactCaptured = metadata.contact_captured || false;

  // Update intent in metadata
  if (intentType !== "general_inquiry") {
    metadata.intent_type = intentType;
    metadata.requested_action = requestedAction;
  }

  // Handle contact info extraction
  if (extractedInfo.email || extractedInfo.phone || extractedInfo.name) {
    const leadUpdate: any = {
      business_id: businessId,
      conversation_id: currentConversationId,
      source: source,
    };
    if (extractedInfo.email) leadUpdate.email = extractedInfo.email;
    if (extractedInfo.phone) leadUpdate.phone = extractedInfo.phone;
    if (extractedInfo.name) leadUpdate.name = extractedInfo.name;
    if (intentType !== "general_inquiry") leadUpdate.interest = requestedAction;

    // Upsert lead
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("conversation_id", currentConversationId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (existingLead) {
      await supabase
        .from("leads")
        .update(leadUpdate)
        .eq("id", existingLead.id)
        .eq("business_id", businessId);
    } else {
      // Check lead limit before creating new lead
      const leadCheck = await checkUsageLimit(businessId, "lead");
      if (!leadCheck.allowed) {
        // Don't block chat, just add metadata note
        metadata.lead_limit_reached = true;
      } else {
        const { error: leadInsertError } = await supabase.from("leads").insert(leadUpdate);
        if (!leadInsertError) {
          await sendLeadNotificationEmail({
            to: business.contact_email,
            businessId,
            businessName: business.name,
            leadName: extractedInfo.name,
            leadEmail: extractedInfo.email,
            leadPhone: extractedInfo.phone,
            interest: intentType !== "general_inquiry" ? requestedAction : null,
          });
          await incrementUsage(businessId, "lead", 1, { conversation_id: currentConversationId });
        }
      }
    }

    if (extractedInfo.email || extractedInfo.phone) {
      contactCaptured = true;
      metadata.contact_captured = true;
      metadata.email_collected_early = true;
      
      // Update conversation visitor info if possible
      const convUpdate: any = { lead_captured: true };
      if (extractedInfo.email) convUpdate.visitor_email = extractedInfo.email;
      if (extractedInfo.name) convUpdate.visitor_name = extractedInfo.name;
      if (extractedInfo.phone) convUpdate.visitor_phone = extractedInfo.phone;
      
      await supabase
        .from("conversations")
        .update(convUpdate)
        .eq("id", currentConversationId)
        .eq("business_id", businessId);
    }
  }

  // If this is an early interaction and contact hasn't been requested
  if (!contactRequested && !contactCaptured) {
    metadata.contact_requested = true;
    // We don't need to manually inject a message here, 
    // the system prompt rules in buildBusinessPrompt will handle the AI asking.
  }

  // Update conversation metadata
  await supabase
    .from("conversations")
    .update({ 
      metadata,
      updated_at: new Date().toISOString()
    })
    .eq("id", currentConversationId)
    .eq("business_id", businessId);

  // 3. Save user message
  const { error: userMsgError } = await supabase.from("messages").insert({
    conversation_id: currentConversationId,
    business_id: businessId,
    role: "user",
    content: message,
  });

  if (userMsgError) throw new Error(`Failed to save user message: ${userMsgError.message}`);

  // 4. RAG: Search knowledge base. If embeddings are unavailable or over quota,
  // keep chat alive and answer from the base business profile instead.
  let matchedChunks: { content: string; similarity: number }[] = [];
  try {
    const queryEmbedding = await generateEmbedding(message);
    const { data, error: rpcError } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: queryEmbedding,
      match_business_id: businessId,
      match_count: 5,
    });

    if (rpcError) throw new Error(`Knowledge search failed: ${rpcError.message}`);
    matchedChunks = data || [];
  } catch (knowledgeError: any) {
    logErrorSync(knowledgeError, "embedding-generation", { businessId });
  }

  // 5. Fetch Conversation History
  const { data: historyMsgs } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", currentConversationId)
    .eq("business_id", businessId)
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

  // 7. Increment usage after successful AI response
  await incrementUsage(businessId, usageType, 1, {
    conversation_id: currentConversationId,
    source,
  });

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
    logErrorSync(err, "ai-provider");
    return { error: getUserFriendlyError("ai-provider") };
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
