import { createServiceClient } from "@/utils/supabase/service";

export class ConversationAccessError extends Error {
  constructor(message = "Conversation not found.") {
    super(message);
    this.name = "ConversationAccessError";
  }
}

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

      await supabase.rpc("increment_demo_message_count", {
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

    if (!existingConversation) throw new ConversationAccessError();

    const isPublicVisitorConversation =
      !isDemo && (source === "widget" || source === "hosted_chat");

    if (isPublicVisitorConversation) {
      const originalVisitorId = existingConversation.visitor_id as string | null;

      if (!originalVisitorId) {
        if (!visitorId) throw new ConversationAccessError();

        const { data: boundConversation, error: bindError } = await supabase
          .from("conversations")
          .update({ visitor_id: visitorId })
          .eq("id", conversationId)
          .is("visitor_id", null)
          .select("visitor_id")
          .maybeSingle();

        if (bindError) {
          throw new Error(`Failed to bind conversation to visitor: ${bindError.message}`);
        }

        if (!boundConversation) {
          const { data: currentConversation, error: recheckError } = await supabase
            .from("conversations")
            .select("visitor_id")
            .eq("id", conversationId)
            .eq("business_id", businessId)
            .maybeSingle();

          if (recheckError) {
            throw new Error(`Failed to verify conversation ownership: ${recheckError.message}`);
          }
          if (!currentConversation || currentConversation.visitor_id !== visitorId) {
            throw new ConversationAccessError();
          }
        }

        existingConversation.visitor_id = visitorId;
      } else if (!visitorId || originalVisitorId !== visitorId) {
        throw new ConversationAccessError();
      }
    }

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
