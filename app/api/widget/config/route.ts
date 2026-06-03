import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { corsHeaders, jsonWithCors } from "@/lib/http/cors";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";
import { z } from "zod";
import { getConfig } from "@/lib/config/platform-config";

const widgetConfigQuerySchema = z.object({
  businessId: z.string().uuid(),
});

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function getRequestHost(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const value = origin || referer;
  if (!value) return null;

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isAllowedHost(hostname: string, allowedDomains: string[] | null | undefined) {
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

export async function GET(req: NextRequest) {
  try {
    const widgetEnabled = await getConfig("feature_flags", "enable_widget");
    if (widgetEnabled === "false") {
      return jsonWithCors({ error: "Widget operations are globally disabled." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = widgetConfigQuerySchema.safeParse({
      businessId: searchParams.get("businessId"),
    });
    if (!parsed.success) {
      return jsonWithCors({ error: "Invalid widget config request." }, { status: 400 });
    }
    const { businessId } = parsed.data;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`${ip}:${businessId}`, "widget_config");
    if (!rl.success) return rateLimitResponse(rl, corsHeaders);

    const supabase = createServiceClient();

    // Fetch business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      return jsonWithCors({ error: "Business not found" }, { status: 404 });
    }

    // Fetch assistant
    const { data: assistant } = await supabase
      .from("assistants")
      .select("name, welcome_message")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .maybeSingle();

    // Fetch widget_config
    const { data: config, error: configError } = await supabase
      .from("widget_configs")
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (configError || !config) {
      return jsonWithCors({ error: "Widget config not found" }, { status: 404 });
    }

    if (!config.is_enabled) {
      return jsonWithCors({ isEnabled: false }, { status: 200 });
    }

    const requestHost = getRequestHost(req);
    if (!isAllowedHost(requestHost || "", config.allowed_domains)) {
      return jsonWithCors({ error: "Domain not allowed" }, { status: 403 });
    }

    return jsonWithCors({
      businessId: business.id,
      businessName: business.name,
      assistantName: assistant?.name || "AI Assistant",
      welcomeText: config.welcome_text || assistant?.welcome_message || "Hello! How can I help you today?",
      primaryColor: config.primary_color,
      position: config.position,
      suggestedQuestions: config.suggested_questions,
      avatarUrl: config.avatar_url,
      isEnabled: config.is_enabled,
      showBranding: config.show_branding,
    });
  } catch (error: unknown) {
    logErrorSync(error, "widget-config");
    return jsonWithCors({ error: getUserFriendlyError("widget-config") }, { status: 500 });
  }
}
