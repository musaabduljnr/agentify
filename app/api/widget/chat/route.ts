import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { corsHeaders, jsonWithCors } from "@/lib/http/cors";
import { runBusinessChat } from "@/lib/actions/chat";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, conversationId, visitorId, message, pageUrl } = body;

    if (!businessId || !message) {
      return jsonWithCors({ error: "Missing businessId or message" }, { status: 400 });
    }

    if (message.length > 1000) {
      return jsonWithCors({ error: "Message too long" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if widget is enabled and optional domain check
    const { data: config, error: configError } = await supabase
      .from("widget_configs")
      .select("is_enabled, allowed_domains")
      .eq("business_id", businessId)
      .single();

    if (configError || !config) {
      return jsonWithCors({ error: "Widget not configured" }, { status: 404 });
    }

    if (!config.is_enabled) {
      return jsonWithCors({ error: "Widget is disabled" }, { status: 403 });
    }

    // Domain check
    if (config.allowed_domains && config.allowed_domains.length > 0 && pageUrl) {
      try {
        const hostname = new URL(pageUrl).hostname;
        const isAllowed = config.allowed_domains.some((domain: string) => 
          hostname === domain || hostname.endsWith("." + domain)
        );
        if (!isAllowed) {
          return jsonWithCors({ error: "Domain not allowed" }, { status: 403 });
        }
      } catch (e) {
        console.error("Invalid pageUrl:", pageUrl);
      }
    }

    const result = await runBusinessChat({
      message,
      businessId,
      conversationId,
      visitorId,
      source: "widget",
    });

    return jsonWithCors({
      conversationId: result.conversationId,
      reply: result.reply,
    });
  } catch (error: any) {
    console.error("Widget chat error:", error);
    return jsonWithCors({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
