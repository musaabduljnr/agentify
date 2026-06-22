"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { revalidatePath } from "next/cache";
import { retrieveBusinessContext } from "@/lib/ai/rag/retrieve-context";
import { getRecentConversationMessages } from "@/lib/ai/memory/message-history";
import { summarizeConversationIfNeeded } from "@/lib/ai/memory/conversation-summary";
import { buildBusinessSystemPrompt } from "@/lib/ai/prompts/business-system-prompt";
import { generateChatResponse } from "@/lib/ai/engine/chat";
import { type FeatureSource } from "@/lib/ai/logs/ai-logs";
import { runResponseQualityChecks } from "@/lib/ai/evaluation/quality-checks";
import { 
  detectLeadIntent, 
  extractLeadInfo, 
  detectConversationIntent 
} from "@/lib/ai/lead-detection";
import { checkUsageLimit, incrementUsage, verifyAIUsageLimits } from "@/lib/billing/usage";
import { requireActiveSubscription } from "@/lib/billing/subscription";
import { rateLimit } from "@/lib/security/rate-limit";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { NewLeadEmail } from "@/lib/email/templates/new-lead-email";
import { BookingRequestEmail } from "@/lib/email/templates/booking-request-email";
import { SupportRequestEmail } from "@/lib/email/templates/support-request-email";
import { UsageWarningEmail } from "@/lib/email/templates/usage-warning-email";
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

/**
 * Searches historical user-assistant message pairs in this business to reuse cached responses.
 */
async function checkResponseCache(businessId: string, query: string): Promise<string | null> {
  try {
    const normalized = query.toLowerCase().trim().replace(/[?.!,;:]/g, "").replace(/\s+/g, " ");
    const supabase = createServiceClient();
    
    // Fetch 50 most recent user messages for this business
    const { data: matchedMsgs } = await supabase
      .from("messages")
      .select("conversation_id, created_at, content")
      .eq("business_id", businessId)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!matchedMsgs || matchedMsgs.length === 0) return null;

    const match = matchedMsgs.find(m => {
      const normMsg = m.content.toLowerCase().trim().replace(/[?.!,;:]/g, "").replace(/\s+/g, " ");
      return normMsg === normalized;
    });

    if (!match) return null;

    // Fetch the assistant response in that conversation immediately after
    const { data: replyMsg } = await supabase
      .from("messages")
      .select("content")
      .eq("conversation_id", match.conversation_id)
      .eq("role", "assistant")
      .gt("created_at", match.created_at)
      .order("created_at", { ascending: true })
      .limit(1);

    if (replyMsg && replyMsg.length > 0) {
      return replyMsg[0].content;
    }
  } catch (err) {
    console.error("[FAQ Cache Error] Failed to search cache:", err);
  }
  return null;
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
  let currentConversationId = conversationId;
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
    // Enforce active subscription status, monthly limits, and daily caps centrally
    const checkResult = await verifyAIUsageLimits(businessId);
    if (!checkResult.allowed) {
      return {
        success: false,
        conversationId: currentConversationId || "",
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

  // 2.5 Usage Quota Checks (Non-demo)
  const usageType = source === "widget" ? "widget_chat" as const : "message" as const;

  // 3. Resolve or Create Conversation
  let conversation: any = null;
  if (!currentConversationId) {
    // Create standard conversation
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

    if (convError || !conv) throw new Error(`Failed to create conversation: ${convError?.message}`);
    currentConversationId = conv.id;
    conversation = conv;

    if (isDemo && demoBusinessId) {
      // Create demo conversation
      await supabase.from("demo_conversations").insert({
        id: currentConversationId,
        demo_business_id: demoBusinessId,
        visitor_id: visitorId,
        source: source,
        first_message: message,
        last_message: message,
        message_count: 1,
      });

      // Update demo counts atomically via RPC
      await supabase.rpc("increment_demo_conversation_count", {
        p_demo_id: demoBusinessId,
      });

      // Log event
      await supabase.from("demo_events").insert({
        demo_business_id: demoBusinessId,
        visitor_id: visitorId,
        event_type: "conversation_started",
        metadata: { conversation_id: currentConversationId },
      });
    }
  } else {
    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", currentConversationId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!existingConversation) throw new Error("Conversation not found.");
    conversation = existingConversation;

    if (isDemo && demoBusinessId) {
      // Update demo conversation counts atomically via RPC
      await supabase.rpc("increment_demo_conversation_msg_count", {
        p_conv_id: currentConversationId,
        p_last_message: message,
      });

      // Update demo messages total atomically via RPC
      await supabase.rpc("increment_demo_message_count", {
        p_demo_id: demoBusinessId,
      });

      // Log event
      await supabase.from("demo_events").insert({
        demo_business_id: demoBusinessId,
        visitor_id: visitorId,
        event_type: "message_sent",
        metadata: { conversation_id: currentConversationId, length: message.length },
      });
    }
  }

  // 4. Save User Message
  const { error: userMsgError } = await supabase.from("messages").insert({
    conversation_id: currentConversationId,
    business_id: businessId,
    role: "user",
    content: message,
  });

  if (userMsgError) throw new Error(`Failed to save user message: ${userMsgError.message}`);

  // If manual takeover is active, save the user message but skip AI response generation
  const isManualTakeover = conversation?.is_manual_takeover || conversation?.metadata?.is_manual_takeover === true;
  if (isManualTakeover) {
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", currentConversationId);

    return {
      success: true,
      conversationId: currentConversationId,
      reply: null,
      assistantMessage: null,
      isManualTakeover: true,
    };
  }

  // 5. RAG Retrieval & Intent Classification
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

  // 6. Lead intelligence & Contact Extraction
  const metadata = (conversation?.metadata as any) || {};
  const hasBuyingIntent = detectLeadIntent(message);
  const { intentType, requestedAction } = detectConversationIntent(message);
  const extractedInfo = extractLeadInfo(message);

  let contactRequested = metadata.contact_requested || false;
  let contactCaptured = metadata.contact_captured || false;

  if (intentType !== "general_inquiry") {
    metadata.intent_type = intentType;
    metadata.requested_action = requestedAction;
  }

  const conversationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app"}/dashboard/conversations?id=${currentConversationId}`;

  // Alerts triggering (email alerts for high intent, non-demo only)
  if (!isDemo) {
    if (intentType === "booking" && !metadata.booking_email_sent) {
      metadata.booking_email_sent = true;
      sendTransactionalEmail({
        businessId,
        subject: "New booking request from your AI assistant",
        templateName: "booking-request-email",
        react: BookingRequestEmail({
          businessName: business.name,
          leadName: extractedInfo.name || conversation?.visitor_name,
          leadEmail: extractedInfo.email || conversation?.visitor_email,
          leadPhone: extractedInfo.phone || conversation?.visitor_phone,
          requestedAction,
          conversationUrl,
        }),
      }).catch(err => console.error("Error triggering booking email:", err));
    }

    if (intentType === "support_ticket" && !metadata.support_email_sent) {
      metadata.support_email_sent = true;
      sendTransactionalEmail({
        businessId,
        subject: "New support request from your AI assistant",
        templateName: "support-request-email",
        react: SupportRequestEmail({
          businessName: business.name,
          leadName: extractedInfo.name || conversation?.visitor_name,
          leadEmail: extractedInfo.email || conversation?.visitor_email,
          issueSummary: message,
          conversationUrl,
        }),
      }).catch(err => console.error("Error triggering support email:", err));
    }
  }

  // Lead record updates
  if (extractedInfo.email || extractedInfo.phone || extractedInfo.name) {
    if (isDemo && demoBusinessId) {
      // Upsert lead in demo_leads
      const { data: existingLead } = await supabase
        .from("demo_leads")
        .select("id")
        .eq("conversation_id", currentConversationId)
        .maybeSingle();

      const leadData: Record<string, any> = {
        demo_business_id: demoBusinessId,
        conversation_id: currentConversationId,
        interest: requestedAction || "Demo Interaction",
      };
      if (extractedInfo.name) leadData.name = extractedInfo.name;
      if (extractedInfo.email) leadData.email = extractedInfo.email;
      if (extractedInfo.phone) leadData.phone = extractedInfo.phone;

      if (existingLead) {
        await supabase.from("demo_leads").update(leadData).eq("id", existingLead.id);
      } else {
        await supabase.from("demo_leads").insert(leadData);

        // Update demo lead count atomically via RPC
        await supabase.rpc("increment_demo_lead_count", {
          p_demo_id: demoBusinessId,
        });

        await supabase.from("demo_events").insert({
          demo_business_id: demoBusinessId,
          visitor_id: visitorId,
          event_type: "lead_captured",
          metadata: { conversation_id: currentConversationId, lead_info: extractedInfo },
        });

        await supabase
          .from("demo_conversations")
          .update({ lead_captured: true })
          .eq("id", currentConversationId);
      }
    } else {
      // Standard lead pipeline
      const leadUpdate: any = {
        business_id: businessId,
        conversation_id: currentConversationId,
        source: source,
      };
      if (extractedInfo.email) leadUpdate.email = extractedInfo.email;
      if (extractedInfo.phone) leadUpdate.phone = extractedInfo.phone;
      if (extractedInfo.name) leadUpdate.name = extractedInfo.name;
      if (intentType !== "general_inquiry") leadUpdate.interest = requestedAction;

      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("conversation_id", currentConversationId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (existingLead) {
        await supabase.from("leads").update(leadUpdate).eq("id", existingLead.id);
      } else {
        const leadCheck = await checkUsageLimit(businessId, "lead");
        if (!leadCheck.allowed) {
          metadata.lead_limit_reached = true;
        } else {
          const { error: leadInsertError } = await supabase.from("leads").insert(leadUpdate);
          if (!leadInsertError) {
            await sendTransactionalEmail({
              businessId,
              subject: "New lead captured by Agentify",
              templateName: "new-lead-email",
              react: NewLeadEmail({
                businessName: business.name,
                leadName: extractedInfo.name,
                leadEmail: extractedInfo.email,
                leadPhone: extractedInfo.phone,
                interest: intentType !== "general_inquiry" ? requestedAction : null,
                intentType,
                conversationUrl,
              }),
            });
            await incrementUsage(businessId, "lead", 1, { conversation_id: currentConversationId });
          }
        }
      }
    }

    if (extractedInfo.email || extractedInfo.phone) {
      contactCaptured = true;
      metadata.contact_captured = true;
      metadata.email_collected_early = true;
      
      const convUpdate: any = { lead_captured: true };
      if (extractedInfo.email) convUpdate.visitor_email = extractedInfo.email;
      if (extractedInfo.name) convUpdate.visitor_name = extractedInfo.name;
      if (extractedInfo.phone) convUpdate.visitor_phone = extractedInfo.phone;
      
      await supabase
        .from("conversations")
        .update(convUpdate)
        .eq("id", currentConversationId);
    }
  }

  if (!contactRequested && !contactCaptured) {
    metadata.contact_requested = true;
  }

  await supabase
    .from("conversations")
    .update({ 
      metadata,
      updated_at: new Date().toISOString()
    })
    .eq("id", currentConversationId);

  // 7. Conversation Summary & Memory History
  const summary = await summarizeConversationIfNeeded(currentConversationId!, businessId, computedFeatureSource);
  const history = await getRecentConversationMessages(currentConversationId!, 4); // Limit memory history to 4 turns instead of 8

  // 8. Generate Prompt & Call AI Engine (with FAQ Cache check)
  let finalReply: string;
  let chatResponse: { provider: string; model: string; latencyMs: number } | null = null;
  
  const cachedAnswer = await checkResponseCache(businessId, message);

  if (cachedAnswer) {
    console.log(`[AI Engine] FAQ Cache Hit for business ${businessId}. Query: "${message}"`);
    finalReply = cachedAnswer;
    chatResponse = {
      provider: "cache",
      model: "cache",
      latencyMs: 0,
    };
  } else {
    let promptInstructions = buildBusinessSystemPrompt({
      business,
      assistant,
      contextText: formattedContext,
      isDemo,
      metadata: {
        ...metadata,
        email_collected_early: metadata.email_collected_early,
        phone_collected: !!(extractedInfo.phone || conversation?.visitor_phone),
      }
    });

    if (summary) {
      promptInstructions = `[Conversation Summary of previous messages: ${summary}]\n\n` + promptInstructions;
    }

    if (isContinuation) {
      promptInstructions += `\n\n# CONTINUATION INSTRUCTION\n- The user has requested that you "Continue" your response from where you stopped. Please resume writing your previous response from exactly where it was cut off or stopped. Do NOT repeat the parts you have already written; simply resume writing and complete the explanation smoothly. Ensure the continuation connects naturally to the last sentence of your previous message.`;
    }

    // Call the core AI router
    const rawChatResponse = await generateChatResponse({
      provider: assistant.provider,
      model: assistant.chat_model,
      systemInstruction: promptInstructions,
      userMessage: message,
      history,
      temperature: Number(assistant.temperature) || 0.4,
      businessId,
      conversationId: currentConversationId,
      featureSource: computedFeatureSource,
    });

    chatResponse = {
      provider: rawChatResponse.provider,
      model: rawChatResponse.model,
      latencyMs: rawChatResponse.latencyMs,
    };

    // 9. Quality Evaluation Check
    const quality = runResponseQualityChecks(rawChatResponse.text, business, formattedContext);
    finalReply = quality.sanitizedText;
  }

  // 10. Save Assistant Response
  const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: currentConversationId,
      business_id: businessId,
      role: "assistant",
      content: finalReply,
      retrieved_chunks: chunks || [],
      metadata: {
        intent,
        quality_passed: !cachedAnswer ? true : false,
        provider: chatResponse.provider,
        model: chatResponse.model,
        latency_ms: chatResponse.latencyMs,
      }
    })
    .select()
    .single();

  if (assistantMsgError) throw new Error(`Failed to save assistant response: ${assistantMsgError.message}`);

  // 11. Usage Increments (Non-demo)
  if (!isDemo) {
    await incrementUsage(businessId, usageType, 1, {
      conversation_id: currentConversationId,
      source,
      cached: !!cachedAnswer,
    });

    // Check for 80% usage threshold warning
    const finalCheck = await checkUsageLimit(businessId, usageType);
    const limit = finalCheck.limit;
    const used = finalCheck.used;
    const percentage = limit > 0 ? (used / limit) * 100 : 0;

    if (percentage >= 80) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle();

      if (sub) {
        const now = new Date();
        const periodStartStr = sub.current_period_start || sub.created_at;
        const periodStart = new Date(periodStartStr);
        const warningSent80AtStr = sub.metadata?.warning_sent_80_message;
        let hasSent80 = false;
        if (warningSent80AtStr && new Date(warningSent80AtStr) >= periodStart) {
          hasSent80 = true;
        }

        if (!hasSent80) {
          const updatedMetadata = {
            ...(sub.metadata || {}),
            warning_sent_80_message: now.toISOString(),
          };
          await supabase
            .from("subscriptions")
            .update({ metadata: updatedMetadata })
            .eq("id", sub.id);

          sendTransactionalEmail({
            businessId,
            subject: "You’re nearing your Agentify usage limit",
            templateName: "usage-warning-email",
            react: UsageWarningEmail({
              businessName: business.name,
              usageType: "AI messages",
              percentage: Math.round(percentage),
              billingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app"}/dashboard/billing`,
            }),
          }).catch(err => console.error("Error sending 80% warning email:", err));
        }
      }
    }
  }

  return {
    success: true,
    conversationId: currentConversationId,
    reply: finalReply,
    assistantMessage: savedAssistantMsg,
    intent,
    latencyMs: chatResponse.latencyMs,
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
  
  // Sort messages in JS to guarantee last_message matches the absolute latest message
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

    // 1. Fetch current metadata
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

    // 2. Try to update both is_manual_takeover and metadata (for migration resilience)
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

    // 1. Verify conversation belongs to this business
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("business_id", business.id)
      .single();

    if (convErr || !conv) throw new Error("Conversation not found");

    // 2. Insert manual message with metadata is_manual: true
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

    // 3. Update conversation's updated_at timestamp to bubble it to the top
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

/**
 * Retrieves all assistants for the current business.
 */
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

/**
 * Creates a new assistant for the current business.
 */
export async function createAssistant(data: {
  name: string;
  tone: string;
  welcome_message: string;
}) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");

    const supabase = await createClient();

    // 1. Fetch current subscription to verify widget_limit
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("widget_limit")
      .eq("business_id", business.id)
      .maybeSingle();

    const limit = sub?.widget_limit || 1;

    // 2. Count existing assistants
    const { count, error: countErr } = await supabase
      .from("assistants")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id);

    if (countErr) throw countErr;

    if ((count || 0) >= limit) {
      return { error: `You've reached the maximum number of assistants (${limit}) allowed under your current plan. Please upgrade to create more.` };
    }

    // 3. Create the new assistant (default is_active to false since they can toggle it later)
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

/**
 * Deletes an assistant. If it was active, sets another remaining assistant as active.
 */
export async function deleteAssistant(assistantId: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");

    const supabase = await createClient();

    // 1. Fetch assistant details
    const { data: assistant, error: fetchErr } = await supabase
      .from("assistants")
      .select("*")
      .eq("id", assistantId)
      .eq("business_id", business.id)
      .single();

    if (fetchErr || !assistant) {
      return { error: "Assistant not found" };
    }

    // Count remaining assistants
    const { data: remaining } = await supabase
      .from("assistants")
      .select("id, is_active")
      .eq("business_id", business.id)
      .neq("id", assistantId)
      .order("created_at", { ascending: true });

    if (!remaining || remaining.length === 0) {
      return { error: "You must keep at least one assistant configuration." };
    }

    // 2. Delete the assistant
    const { error: deleteErr } = await supabase
      .from("assistants")
      .delete()
      .eq("id", assistantId);

    if (deleteErr) throw deleteErr;

    // 3. If the deleted assistant was active, mark the first remaining one as active
    if (assistant.is_active) {
      const { error: activateErr } = await supabase
        .from("assistants")
        .update({ is_active: true })
        .eq("id", remaining[0].id);
      
      if (activateErr) throw activateErr;
    }

    revalidatePath("/dashboard/assistant");
    revalidatePath("/dashboard/playground");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteAssistant:", err);
    return { error: err.message || "Failed to delete assistant" };
  }
}

/**
 * Sets an assistant as the active one and deactivates others.
 */
export async function setActiveAssistant(assistantId: string) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw new Error("No business found");

    const supabase = await createClient();

    // Call transactional RPC to set active assistant
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

