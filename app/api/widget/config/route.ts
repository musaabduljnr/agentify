import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { corsHeaders, jsonWithCors } from "@/lib/http/cors";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return jsonWithCors({ error: "Missing businessId" }, { status: 400 });
    }

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
    const { data: assistant, error: assistantError } = await supabase
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
  } catch (error: any) {
    console.error("Widget config error:", error);
    return jsonWithCors({ error: "Internal server error" }, { status: 500 });
  }
}
