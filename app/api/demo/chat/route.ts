import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { runBusinessChat } from "@/lib/actions/chat";
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

export const MAX_DEMO_AI_REPLIES = 9;
/** @deprecated Use MAX_DEMO_AI_REPLIES */
export const MAX_DEMO_MESSAGES = MAX_DEMO_AI_REPLIES;

export async function POST(req: NextRequest) {
  try {
    const parsed = demoChatSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonWithCors({ error: "Invalid demo chat request." }, { status: 400 });
    }

    const { demoBusinessId, conversationId, visitorId, message, source } = parsed.data;

    // Rate Limit Check using dedicated demo_chat preset
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `demo:${demoBusinessId}:${visitorId || ip}`;
    const rl = await rateLimit(rateLimitKey, "demo_chat");
    if (!rl.success) {
      return rateLimitResponse(rl, corsHeaders);
    }

    const supabase = createServiceClient();

    // Fetch demo business to resolve placeholder_business_id, status, expiry, and demo_ai_reply_count
    const { data: demo, error: demoErr } = await supabase
      .from("demo_businesses")
      .select("placeholder_business_id, status, expires_at, total_message_count, demo_ai_reply_count")
      .eq("id", demoBusinessId)
      .single();

    if (demoErr || !demo) {
      return jsonWithCors({ error: "Demo assistant not found." }, { status: 404 });
    }

    if (demo.status !== "active") {
      return jsonWithCors({ error: `This demo is currently ${demo.status}.` }, { status: 403 });
    }

    const isExpired = new Date(demo.expires_at) < new Date();
    if (isExpired) {
      await supabase
        .from("demo_businesses")
        .update({ status: "expired" })
        .eq("id", demoBusinessId);
        
      return jsonWithCors({ error: "This demo has expired." }, { status: 403 });
    }

    // Enforce strict 9 AI reply budget for anonymous preview drafts
    const currentAiReplyCount = demo.demo_ai_reply_count ?? 0;
    if (currentAiReplyCount >= MAX_DEMO_AI_REPLIES) {
      return jsonWithCors({
        error: `Preview limit reached (${MAX_DEMO_AI_REPLIES}/${MAX_DEMO_AI_REPLIES} AI responses). Create your account to unlock full access.`,
        limitReached: true,
      }, { status: 429 });
    }

    // Call unified runBusinessChat
    const result = await runBusinessChat({
      message,
      businessId: demo.placeholder_business_id,
      conversationId: conversationId || undefined,
      visitorId,
      source,
      isDemo: true,
      demoBusinessId,
    });

    if (!result.success) {
      return jsonWithCors({ error: result.reply || "Failed to generate reply." }, { status: 400 });
    }

    // Increment AI reply count atomically via RPC after successful AI generation
    await supabase.rpc("increment_demo_ai_reply_count", {
      p_demo_id: demoBusinessId,
    });

    return jsonWithCors({
      conversationId: result.conversationId,
      reply: result.reply,
      aiReplyCount: currentAiReplyCount + 1,
      totalMessageCount: currentAiReplyCount + 1,
      maxMessages: MAX_DEMO_AI_REPLIES,
    });
  } catch (error: any) {
    logErrorSync(error, "widget-chat");
    return jsonWithCors({ error: getUserFriendlyError("widget-chat") }, { status: 500 });
  }
}
