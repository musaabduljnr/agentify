import { createServiceClient } from "@/utils/supabase/service";

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
}: {
  conversationId: string;
  businessId: string;
  content: string;
  chunks: any[];
  intent: any;
  cachedAnswer: boolean;
  chatResponse: { provider: string; model: string; latencyMs: number } | null;
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
        quality_passed: !cachedAnswer ? true : false,
        provider: chatResponse?.provider || "unknown",
        model: chatResponse?.model || "unknown",
        latency_ms: chatResponse?.latencyMs || 0,
      }
    })
    .select()
    .single();

  if (assistantMsgError) throw new Error(`Failed to save assistant response: ${assistantMsgError.message}`);
  return savedAssistantMsg;
}
