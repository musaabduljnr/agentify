import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { corsHeaders, jsonWithCors } from "@/lib/http/cors";
import { runBusinessChat } from "@/lib/actions/chat";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";
import { z } from "zod";

type WidgetChatResponse = Awaited<ReturnType<typeof runBusinessChat>> & {
  limitReached?: boolean;
};

const widgetChatSchema = z.object({
  businessId: z.string().uuid(),
  conversationId: z.string().uuid().optional().nullable(),
  visitorId: z.string().trim().max(120).optional().nullable(),
  message: z.string().trim().min(1).max(1000),
  pageUrl: z.string().url().optional().nullable(),
  referrer: z.string().url().optional().nullable(),
  source: z.enum(["widget", "hosted_chat"]).optional().default("widget"),
});

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function getTrustedHost(req: NextRequest, pageUrl?: string): string | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const value = origin || referer || pageUrl;
  if (!value) return null;

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isAllowedHost(hostname: string | null, allowedDomains: string[] | null | undefined) {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  if (!hostname) return false;

  if (process.env.NODE_ENV === "production" && ["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    return false;
  }

  return allowedDomains.some((domain) => {
    const normalized = domain.trim().toLowerCase();
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

export async function POST(req: NextRequest) {
  try {
    const parsed = widgetChatSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonWithCors({ error: "Invalid widget chat request." }, { status: 400 });
    }
    const { businessId, conversationId, visitorId, message, pageUrl, source } = parsed.data;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `${businessId}:${visitorId || ip}`;
    const rl = await rateLimit(rateLimitKey, "widget_chat");
    if (!rl.success) return rateLimitResponse(rl, corsHeaders);

    const supabase = createServiceClient();

    // Check public channel availability and optional widget domain check.
    const { data: config, error: configError } = await supabase
      .from("widget_configs")
      .select("is_enabled, allowed_domains, hosted_chat_enabled")
      .eq("business_id", businessId)
      .single();

    if (configError || !config) {
      return jsonWithCors({ error: "Widget not configured" }, { status: 404 });
    }

    if (source === "widget" && !config.is_enabled) {
      return jsonWithCors({ error: "Widget is disabled" }, { status: 403 });
    }

    if (source === "hosted_chat" && config.hosted_chat_enabled === false) {
      return jsonWithCors({ error: "Hosted chat is disabled" }, { status: 403 });
    }

    const trustedHost = getTrustedHost(req, pageUrl || undefined);
    if (source === "widget" && !isAllowedHost(trustedHost, config.allowed_domains)) {
      return jsonWithCors({ error: "Domain not allowed" }, { status: 403 });
    }

    const result: WidgetChatResponse = await runBusinessChat({
      message,
      businessId,
      conversationId: conversationId || undefined,
      visitorId: visitorId || undefined,
      source,
    });

    return jsonWithCors({
      conversationId: result.conversationId,
      reply: result.reply,
      limitReached: result.limitReached || false,
    });
  } catch (error: unknown) {
    logErrorSync(error, "widget-chat");
    return jsonWithCors({ error: getUserFriendlyError("widget-chat") }, { status: 500 });
  }
}
