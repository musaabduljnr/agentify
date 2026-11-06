import "server-only";

import { createServiceClient } from "@/utils/supabase/service";
import { retrieveBusinessContext } from "@/lib/ai/rag/retrieve-context";
import { getRecentConversationMessages } from "@/lib/ai/memory/message-history";
import { summarizeConversationIfNeeded } from "@/lib/ai/memory/conversation-summary";
import { type FeatureSource } from "@/lib/ai/logs/ai-logs";
import {
  completeUsageQuota,
  releaseUsageQuota,
  reserveUsageQuota,
  type UsageReservation,
  verifyAIUsageLimits,
} from "@/lib/billing/usage";
import { requireBusinessEntitlement } from "@/lib/billing/entitlements";
import { resolveOrCreateConversation, recordConversationKnowledgeVersion } from "./conversation-management";
import {
  isConversationKnowledgeStale,
  readConversationKnowledgeVersion,
  retainUserTurnsOnly,
} from "@/lib/knowledge/lifecycle";
import { saveUserMessage, saveAssistantMessage } from "./message-persistence";
import { processLeadHandling } from "./lead-handling";
import { getAiResponse } from "./ai-response";
import { processUsageTracking } from "./usage-tracking";
import { type ChatMessage } from "@/lib/ai/engine/types";

function stripCurrentUserTurn(history: ChatMessage[], message: string): ChatMessage[] {
  const last = history[history.length - 1];
  if (last && last.role === "user" && last.content.trim() === message.trim()) {
    return history.slice(0, -1);
  }
  return history;
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
    if (new Date(demo.expires_at) < new Date()) {
      await supabase
        .from("demo_businesses")
        .update({ status: "expired" })
        .eq("id", demoBusinessId);
      throw new Error("This demo assistant has expired.");
    }
  } else {
    await requireBusinessEntitlement(businessId, "canUseAi");
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

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();
  if (businessError || !business) throw new Error("Business not found");

  const { data: assistant, error: assistantError } = await supabase
    .from("assistants")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .single();
  if (assistantError || !assistant) throw new Error("Assistant not found");

  const usageType = source === "widget" ? "widget_chat" as const : "message" as const;
  const currentKnowledgeVersion = Number(business.knowledge_version ?? 0);
  const { conversationId: currentConversationId, conversation } = await resolveOrCreateConversation({
    currentConversationId: conversationId,
    businessId,
    visitorId,
    source,
    isDemo,
    demoBusinessId,
    message,
  });

  await saveUserMessage({
    conversationId: currentConversationId!,
    businessId,
    message,
  });

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

  let usageReservation: UsageReservation | null = null;
  if (!isDemo) {
    const reservationResult = await reserveUsageQuota(businessId, usageType, 1, {
      conversation_id: currentConversationId!,
      source,
    });
    usageReservation = reservationResult.reservation;
    if (!usageReservation) {
      return {
        success: false,
        conversationId: currentConversationId!,
        reply: "Your subscription has reached its current usage limit.",
        assistantMessage: null,
        limitReached: true,
      };
    }
  }

  try {
    // The current user turn was already inserted above, so drop it from the
    // prior-turn history before passing it to retrieval and to the model.
    const storedHistory = await getRecentConversationMessages(
      currentConversationId!,
      8,
      currentKnowledgeVersion
    );
    const priorHistory = stripCurrentUserTurn(storedHistory, message);

    // If the business knowledge changed since this conversation last ran,
    // earlier assistant answers may repeat deleted or outdated facts. Keep the
    // visitor's questions for follow-up retrieval, but do not feed old answers
    // back to the model as current evidence.
    const knowledgeChanged =
      isConversationKnowledgeStale(conversation?.metadata, currentKnowledgeVersion) &&
      priorHistory.length > 0;
    const history = knowledgeChanged
      ? retainUserTurnsOnly(priorHistory)
      : priorHistory;

    const { chunks, formattedContext, intent, diagnostics: retrieval } = await retrieveBusinessContext({
      businessId,
      query: message,
      matchCount: 5,
      minSimilarity: 0.55,
      featureSource: computedFeatureSource,
      conversationHistory: history,
    });

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

    const summary = knowledgeChanged
      ? null
      : await summarizeConversationIfNeeded(
          currentConversationId!,
          businessId,
          computedFeatureSource,
          currentKnowledgeVersion
        );
    const { finalReply, chatResponse, cachedAnswer, quality } = await getAiResponse({
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
      knowledgeUpdated: knowledgeChanged,
    });

    const savedAssistantMsg = await saveAssistantMessage({
      conversationId: currentConversationId!,
      businessId,
      content: finalReply,
      chunks,
      intent,
      cachedAnswer,
      chatResponse,
      quality,
      retrieval,
      knowledgeVersion: currentKnowledgeVersion,
    });

    if (
      conversation &&
      readConversationKnowledgeVersion(conversation.metadata) !== currentKnowledgeVersion
    ) {
      await recordConversationKnowledgeVersion(
        currentConversationId!,
        businessId,
        currentKnowledgeVersion
      );
    }

    if (!isDemo) {
      if (usageReservation) await completeUsageQuota(usageReservation);
      await processUsageTracking({
        businessId,
        usageType,
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
  } catch (error) {
    if (usageReservation) await releaseUsageQuota(usageReservation);
    throw error;
  }
}
