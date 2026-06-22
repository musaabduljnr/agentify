import { createServiceClient } from "@/utils/supabase/service";

export async function resolveOrCreateConversation({
  currentConversationId,
  businessId,
  visitorId,
  source,
  isDemo,
  demoBusinessId,
  message,
}: {
  currentConversationId?: string;
  businessId: string;
  visitorId?: string;
  source: string;
  isDemo: boolean;
  demoBusinessId?: string;
  message: string;
}) {
  const supabase = createServiceClient();
  let conversationId = currentConversationId;
  let conversation: any = null;

  if (!conversationId) {
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
    conversationId = conv.id;
    conversation = conv;

    if (isDemo && demoBusinessId) {
      await supabase.from("demo_conversations").insert({
        id: conversationId,
        demo_business_id: demoBusinessId,
        visitor_id: visitorId,
        source: source,
        first_message: message,
        last_message: message,
        message_count: 1,
      });

      await supabase.rpc("increment_demo_conversation_count", {
        p_demo_id: demoBusinessId,
      });

      await supabase.from("demo_events").insert({
        demo_business_id: demoBusinessId,
        visitor_id: visitorId,
        event_type: "conversation_started",
        metadata: { conversation_id: conversationId },
      });
    }
  } else {
    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!existingConversation) throw new Error("Conversation not found.");
    conversation = existingConversation;

    if (isDemo && demoBusinessId) {
      await supabase.rpc("increment_demo_conversation_msg_count", {
        p_conv_id: conversationId,
        p_last_message: message,
      });

      await supabase.rpc("increment_demo_message_count", {
        p_demo_id: demoBusinessId,
      });

      await supabase.from("demo_events").insert({
        demo_business_id: demoBusinessId,
        visitor_id: visitorId,
        event_type: "message_sent",
        metadata: { conversation_id: conversationId, length: message.length },
      });
    }
  }

  return { conversationId, conversation };
}
