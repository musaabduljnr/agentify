import { createServiceClient } from "@/utils/supabase/service";
import { type QualityCheckResult } from "@/lib/ai/evaluation/quality-checks";
import { type RetrievalDiagnostics } from "@/lib/ai/rag/retrieve-context";

export async function saveUserMessage({
  conversationId,
  businessId,
  message,
}: {
  conversationId: string;
  businessId: string;
  message: string;
}) {
  const supabase = createServiceClient();
  const { error: userMsgError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    business_id: businessId,
    role: "user",
    content: message,
  });

  if (userMsgError) throw new Error(`Failed to save user message: ${userMsgError.message}`);
}

export async function saveAssistantMessage({
  conversationId,
  businessId,
  content,
  chunks,
  intent,
  cachedAnswer,
  chatResponse,
  quality,
  retrieval,
}: {
  conversationId: string;
  businessId: string;
  content: string;
  chunks: any[];
  intent: any;
  cachedAnswer: boolean;
  chatResponse: { provider: string; model: string; latencyMs: number; fallbackUsed?: boolean } | null;
  quality?: QualityCheckResult;
  retrieval?: RetrievalDiagnostics;
}) {
  const supabase = createServiceClient();
  const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      business_id: businessId,
      role: "assistant",
      content: content,
      retrieved_chunks: chunks || [],
      metadata: {
        intent,
        quality_passed: quality ? quality.passed : false,
        quality_reason: quality?.reason ?? null,
        fallback_used: chatResponse?.fallbackUsed ?? false,
        provider: chatResponse?.provider || "unknown",
        model: chatResponse?.model || "unknown",
        latency_ms: chatResponse?.latencyMs || 0,
        cached_answer: cachedAnswer,
        retrieval: retrieval ?? null,
      }
    })
    .select()
    .single();

  if (assistantMsgError) throw new Error(`Failed to save assistant response: ${assistantMsgError.message}`);
  return savedAssistantMsg;
}
