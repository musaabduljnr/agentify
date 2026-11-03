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
import { resolveOrCreateConversation } from "./conversation-management";
import { saveUserMessage, saveAssistantMessage } from "./message-persistence";
import { processLeadHandling } from "./lead-handling";
import { getAiResponse } from "./ai-response";
import { processUsageTracking } from "./usage-tracking";

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
    const isContinuation = message.toLowerCase().trim() === "continue";
    let ragQuery = message;

    if (isContinuation && currentConversationId) {
      const { data: recentMsgs } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: false })
        .limit(3);

      if (recentMsgs && recentMsgs.length >= 3 && recentMsgs[2].role === "user") {
        ragQuery = recentMsgs[2].content;
      }
    }

    const { chunks, formattedContext, intent } = await retrieveBusinessContext({
      businessId,
      query: ragQuery,
      matchCount: 5,
      minSimilarity: 0.55,
      featureSource: computedFeatureSource,
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

    const summary = await summarizeConversationIfNeeded(currentConversationId!, businessId, computedFeatureSource);
    const history = await getRecentConversationMessages(currentConversationId!, 4);
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

    const savedAssistantMsg = await saveAssistantMessage({
      conversationId: currentConversationId!,
      businessId,
      content: finalReply,
      chunks,
      intent,
      cachedAnswer,
      chatResponse,
    });

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
