import { createServiceClient } from "@/utils/supabase/service";
import { generateChatResponse } from "@/lib/ai/engine/chat";
import { buildBusinessSystemPrompt } from "@/lib/ai/prompts/business-system-prompt";
import { runResponseQualityChecks } from "@/lib/ai/evaluation/quality-checks";

export async function checkResponseCache(businessId: string, query: string): Promise<string | null> {
  try {
    const normalized = query.toLowerCase().trim().replace(/[?.!,;:]/g, "").replace(/\s+/g, " ");
    const supabase = createServiceClient();
    
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

export async function getAiResponse({
  message,
  businessId,
  conversationId,
  isDemo,
  business,
  assistant,
  formattedContext,
  metadata,
  summary,
  history,
  computedFeatureSource,
}: {
  message: string;
  businessId: string;
  conversationId: string;
  isDemo: boolean;
  business: any;
  assistant: any;
  formattedContext: string;
  metadata: any;
  summary: string | null;
  history: any[];
  computedFeatureSource: string;
}) {
  let finalReply: string;
  let chatResponse: { provider: string; model: string; latencyMs: number } | null = null;
  const isContinuation = message.toLowerCase().trim() === "continue";
  
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
      }
    });

    if (summary) {
      promptInstructions = `[Conversation Summary of previous messages: ${summary}]\n\n` + promptInstructions;
    }

    if (isContinuation) {
      promptInstructions += `\n\n# CONTINUATION INSTRUCTION\n- The user has requested that you "Continue" your response from where you stopped. Please resume writing your previous response from exactly where it was cut off or stopped. Do NOT repeat the parts you have already written; simply resume writing and complete the explanation smoothly. Ensure the continuation connects naturally to the last sentence of your previous message.`;
    }

    const rawChatResponse = await generateChatResponse({
      provider: assistant.provider,
      model: assistant.chat_model,
      systemInstruction: promptInstructions,
      userMessage: message,
      history,
      temperature: Number(assistant.temperature) || 0.4,
      businessId,
      conversationId: conversationId,
      featureSource: computedFeatureSource as any,
    });

    chatResponse = {
      provider: rawChatResponse.provider,
      model: rawChatResponse.model,
      latencyMs: rawChatResponse.latencyMs,
    };

    const quality = runResponseQualityChecks(rawChatResponse.text, business, formattedContext);
    finalReply = quality.sanitizedText;
  }

  return { finalReply, chatResponse, cachedAnswer: !!cachedAnswer };
}
