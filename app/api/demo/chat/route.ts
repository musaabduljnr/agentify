import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { generateEmbedding } from "@/lib/vertex/embeddings";
import { generateGeminiResponse } from "@/lib/vertex/gemini";
import { buildBusinessPrompt } from "@/lib/ai/build-business-prompt";
import { detectLeadIntent, extractLeadInfo, detectConversationIntent } from "@/lib/ai/lead-detection";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";
import { corsHeaders, jsonWithCors } from "@/lib/http/cors";
import { z } from "zod";

const demoChatSchema = z.object({
  demoBusinessId: z.string().uuid(),
  conversationId: z.string().uuid().optional().nullable(),
  visitorId: z.string().trim().max(120),
  message: z.string().trim().min(1).max(1000),
  source: z.string().optional().default("hosted_chat"),
});

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const parsed = demoChatSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonWithCors({ error: "Invalid demo chat request." }, { status: 400 });
    }

    const { demoBusinessId, conversationId, visitorId, message, source } = parsed.data;

    // Rate Limit Check
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `demo:${demoBusinessId}:${visitorId || ip}`;
    const rl = await rateLimit(rateLimitKey, "widget_chat");
    if (!rl.success) {
      return rateLimitResponse(rl, corsHeaders);
    }

    const supabase = createServiceClient();

    // 1. Fetch demo business
    const { data: demo, error: demoErr } = await supabase
      .from("demo_businesses")
      .select("*")
      .eq("id", demoBusinessId)
      .single();

    if (demoErr || !demo) {
      return jsonWithCors({ error: "Demo assistant not found." }, { status: 404 });
    }

    // Check status
    if (demo.status !== "active") {
      return jsonWithCors({ error: `This demo is currently ${demo.status}.` }, { status: 403 });
    }

    // Check expiry
    const isExpired = new Date(demo.expires_at) < new Date();
    if (isExpired) {
      // Auto-update status to expired if it isn't already
      await supabase
        .from("demo_businesses")
        .update({ status: "expired" })
        .eq("id", demoBusinessId);
        
      return jsonWithCors({ error: "This demo has expired." }, { status: 403 });
    }

    let activeConversationId = conversationId;
    let isNewConversation = !activeConversationId;

    // Update demo activity
    await supabase
      .from("demo_businesses")
      .update({
        total_message_count: (demo.total_message_count || 0) + 1,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", demoBusinessId);

    // 2. Resolve or Create Conversation
    if (isNewConversation) {
      // Create standard conversation for messages FK
      const { data: standardConv, error: standardConvErr } = await supabase
        .from("conversations")
        .insert({
          business_id: demo.placeholder_business_id,
          source: "hosted_chat",
          status: "open",
          visitor_id: visitorId,
        })
        .select()
        .single();

      if (standardConvErr || !standardConv) {
        throw new Error(`Failed to create standard conversation: ${standardConvErr?.message}`);
      }

      activeConversationId = standardConv.id;

      // Create demo conversation
      const { error: demoConvErr } = await supabase
        .from("demo_conversations")
        .insert({
          id: activeConversationId,
          demo_business_id: demoBusinessId,
          visitor_id: visitorId,
          source: source,
          first_message: message,
          last_message: message,
          message_count: 1,
        });

      if (demoConvErr) {
        throw new Error(`Failed to create demo conversation: ${demoConvErr.message}`);
      }

      // Update conversation count
      await supabase
        .from("demo_businesses")
        .update({
          conversation_count: (demo.conversation_count || 0) + 1,
        })
        .eq("id", demoBusinessId);

      // Log event
      await supabase.from("demo_events").insert({
        demo_business_id: demoBusinessId,
        visitor_id: visitorId,
        event_type: "conversation_started",
        metadata: { conversation_id: activeConversationId }
      });
    } else {
      // Update existing demo conversation
      const { data: existingDemoConv, error: demoConvFetchErr } = await supabase
        .from("demo_conversations")
        .select("*")
        .eq("id", activeConversationId)
        .single();

      if (demoConvFetchErr || !existingDemoConv) {
        return jsonWithCors({ error: "Conversation not found." }, { status: 404 });
      }

      await supabase
        .from("demo_conversations")
        .update({
          last_message: message,
          message_count: (existingDemoConv.message_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeConversationId);
    }

    // Log message sent event
    await supabase.from("demo_events").insert({
      demo_business_id: demoBusinessId,
      visitor_id: visitorId,
      event_type: "message_sent",
      metadata: { conversation_id: activeConversationId, length: message.length }
    });

    // 3. Save user message to standard messages table
    const { error: userMsgError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      business_id: demo.placeholder_business_id,
      role: "user",
      content: message,
    });

    if (userMsgError) throw new Error(`Failed to save user message: ${userMsgError.message}`);

    // 4. RAG: Search knowledge chunks
    let matchedChunks: { content: string; similarity: number }[] = [];
    try {
      const queryEmbedding = await generateEmbedding(message);
      const { data, error: rpcError } = await supabase.rpc("match_knowledge_chunks", {
        query_embedding: queryEmbedding,
        match_business_id: demo.placeholder_business_id,
        match_count: 5,
      });

      if (!rpcError && data) {
        matchedChunks = data;
      }
    } catch (knowledgeError) {
      console.error("Knowledge search failed for demo:", knowledgeError);
    }

    // 5. Fetch Conversation History
    const { data: historyMsgs } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", activeConversationId)
      .eq("business_id", demo.placeholder_business_id)
      .order("created_at", { ascending: true })
      .limit(15);

    const history = (historyMsgs || [])
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        content: m.content,
      }));

    // 6. Load assistant and business profiles
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", demo.placeholder_business_id)
      .single();

    const { data: assistant } = await supabase
      .from("assistants")
      .select("*")
      .eq("business_id", demo.placeholder_business_id)
      .eq("is_active", true)
      .single();

    if (!business || !assistant) {
      throw new Error("Demo assistant configurations not found.");
    }

    // 7. Generate Gemini Response
    const systemPrompt = buildBusinessPrompt({
      business,
      assistant,
      contextChunks: matchedChunks,
    });

    const reply = await generateGeminiResponse({
      systemInstruction: systemPrompt,
      userMessage: message,
      history,
      temperature: Number(assistant.temperature) || 0.4,
    });

    // 8. Save assistant message
    await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      business_id: demo.placeholder_business_id,
      role: "assistant",
      content: reply,
      retrieved_chunks: matchedChunks,
    });

    // 9. Lead Detection & Intelligence
    const hasIntent = detectLeadIntent(message);
    const extractedInfo = extractLeadInfo(message);
    const { requestedAction } = detectConversationIntent(message);

    if (extractedInfo.email || extractedInfo.phone || extractedInfo.name) {
      // Upsert lead in demo_leads
      const { data: existingLead } = await supabase
        .from("demo_leads")
        .select("id")
        .eq("conversation_id", activeConversationId)
        .maybeSingle();

      const leadData: Record<string, any> = {
        demo_business_id: demoBusinessId,
        conversation_id: activeConversationId,
        interest: requestedAction || "Demo Interaction",
      };
      if (extractedInfo.name) leadData.name = extractedInfo.name;
      if (extractedInfo.email) leadData.email = extractedInfo.email;
      if (extractedInfo.phone) leadData.phone = extractedInfo.phone;

      if (existingLead) {
        await supabase
          .from("demo_leads")
          .update(leadData)
          .eq("id", existingLead.id);
      } else {
        await supabase.from("demo_leads").insert(leadData);

        // Update counts and log event
        await supabase
          .from("demo_businesses")
          .update({
            lead_count: (demo.lead_count || 0) + 1,
          })
          .eq("id", demoBusinessId);

        await supabase.from("demo_events").insert({
          demo_business_id: demoBusinessId,
          visitor_id: visitorId,
          event_type: "lead_captured",
          metadata: { conversation_id: activeConversationId, lead_info: extractedInfo }
        });

        // Set lead captured on conversation
        await supabase
          .from("demo_conversations")
          .update({ lead_captured: true })
          .eq("id", activeConversationId);
      }
    }

    return jsonWithCors({
      conversationId: activeConversationId,
      reply,
    });
  } catch (error: any) {
    logErrorSync(error, "widget-chat");
    return jsonWithCors({ error: getUserFriendlyError("widget-chat") }, { status: 500 });
  }
}
