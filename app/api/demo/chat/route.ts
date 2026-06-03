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

    // Fetch demo business to resolve placeholder_business_id
    const { data: demo, error: demoErr } = await supabase
      .from("demo_businesses")
      .select("placeholder_business_id, status, expires_at")
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

    return jsonWithCors({
      conversationId: result.conversationId,
      reply: result.reply,
    });
  } catch (error: any) {
    logErrorSync(error, "widget-chat");
    return jsonWithCors({ error: getUserFriendlyError("widget-chat") }, { status: 500 });
  }
}
