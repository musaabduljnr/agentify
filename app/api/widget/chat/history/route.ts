import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { corsHeaders, jsonWithCors } from "@/lib/http/cors";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return jsonWithCors({ error: "Missing conversationId" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch conversation status/metadata to check is_manual_takeover
    const { data: conversation, error: convErr } = await supabase
      .from("conversations")
      .select("is_manual_takeover, metadata")
      .eq("id", conversationId)
      .maybeSingle();

    if (convErr) {
      return jsonWithCors({ error: convErr.message }, { status: 500 });
    }

    // Fetch messages for the conversation
    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("id, role, content, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      return jsonWithCors({ error: msgErr.message }, { status: 500 });
    }

    return jsonWithCors({
      messages: messages || [],
      isManualTakeover: conversation?.is_manual_takeover || conversation?.metadata?.is_manual_takeover === true || false,
    });
  } catch (error: any) {
    return jsonWithCors({ error: error.message || "Failed to retrieve history" }, { status: 500 });
  }
}
