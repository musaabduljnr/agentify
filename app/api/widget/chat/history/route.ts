import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { corsHeaders, jsonWithCors } from "@/lib/http/cors";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const visitorId = searchParams.get("visitorId");

    if (!conversationId) {
      return jsonWithCors({ error: "Missing conversationId" }, { status: 400 });
    }

    // Rate Limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `history:${conversationId}:${visitorId || ip}`;
    const rl = await rateLimit(rateLimitKey, "widget_config");
    if (!rl.success) {
      return rateLimitResponse(rl, corsHeaders);
    }

    const supabase = createServiceClient();

    // Fetch conversation status/metadata to check ownership/visitor
    const { data: conversation, error: convErr } = await supabase
      .from("conversations")
      .select("is_manual_takeover, metadata, visitor_id, business_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convErr) {
      return jsonWithCors({ error: convErr.message }, { status: 500 });
    }

    if (!conversation) {
      return jsonWithCors({ error: "Conversation not found" }, { status: 404 });
    }

    let isAuthorized = false;

    // A. Check if visitorId matches the conversation's visitor_id
    if (visitorId && conversation.visitor_id === visitorId) {
      isAuthorized = true;
    }

    // B. Check if authenticated user owns the business or is admin
    if (!isAuthorized) {
      const userSupabase = await createClient();
      const { data: { user } } = await userSupabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "admin") {
          isAuthorized = true;
        } else {
          const { data: business } = await supabase
            .from("businesses")
            .select("id")
            .eq("id", conversation.business_id)
            .eq("owner_id", user.id)
            .maybeSingle();

          if (business) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return jsonWithCors({ error: "Unauthorized access to conversation history" }, { status: 403 });
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
    return jsonWithCors({ error: "Failed to retrieve history" }, { status: 500 });
  }
}
