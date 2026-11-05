import { generateChatResponse } from "@/lib/ai/engine/chat";
import { buildBusinessSystemPrompt } from "@/lib/ai/prompts/business-system-prompt";
import {
  runResponseQualityChecks,
  type QualityCheckResult,
} from "@/lib/ai/evaluation/quality-checks";

// NOTE: The previous cross-conversation FAQ cache was removed. It returned a
// historical reply from an unrelated conversation for any matching user text,
// bypassing retrieval entirely and leaking stale answers across visitors.
// Retrieval now always runs against the current business knowledge base.

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
  const isContinuation = message.toLowerCase().trim() === "continue";

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

  // Conversation memory is only a compression of prior turns. It must never
  // outrank the retrieved knowledge base or the verified business profile.
  if (summary) {
    promptInstructions =
      `# SECONDARY CONVERSATION MEMORY\n` +
      `The following is a compressed summary of earlier turns in this conversation. ` +
      `Use it to understand what the visitor already asked, but treat it as non-authoritative: ` +
      `it may be incomplete or outdated. If it conflicts with the knowledge base or the business profile, ` +
      `those sources win. Never quote or mention this summary directly.\n` +
      `Summary: ${summary}\n\n` +
      promptInstructions;
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
    maxOutputTokens: 1000,
    businessId,
    conversationId: conversationId,
    featureSource: computedFeatureSource as any,
  });

  const quality: QualityCheckResult = runResponseQualityChecks(
    rawChatResponse.text,
    business,
    formattedContext
  );

  return {
    finalReply: quality.sanitizedText,
    chatResponse: {
      provider: rawChatResponse.provider,
      model: rawChatResponse.model,
      latencyMs: rawChatResponse.latencyMs,
      fallbackUsed: rawChatResponse.fallbackUsed,
    },
    quality,
    cachedAnswer: false,
  };
}
