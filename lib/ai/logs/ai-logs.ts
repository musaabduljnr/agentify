import "server-only";
import { createServiceClient } from "@/utils/supabase/service";

export type FeatureSource =
  | "demo_generation"
  | "assistant_prompt_generation"
  | "welcome_message_generation"
  | "suggested_questions_generation"
  | "website_summary_generation"
  | "embeddings_generation"
  | "hosted_chat"
  | "playground"
  | "admin_test";

interface LogParams {
  businessId?: string;
  conversationId?: string;
  provider: string;
  model: string;
  fallbackUsed?: boolean;
  promptTokensEstimate?: number;
  responseTokensEstimate?: number;
  latencyMs: number;
  status: "success" | "failed" | "fallback_success";
  errorMessage?: string;
  metadata?: Record<string, any>;
  featureSource?: FeatureSource;
}

export async function writeAIEngineLog(params: LogParams): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // 1. Console Log (Required)
  console.log(
    `[AI Request Log] business_id: ${params.businessId || "null"}, ` +
    `provider: ${params.provider}, ` +
    `model: ${params.model}, ` +
    `feature_source: ${params.featureSource || "null"}, ` +
    `timestamp: ${timestamp}`
  );

  try {
    const supabase = createServiceClient();
    
    // Clean metadata of secrets if any
    const cleanMetadata = { ...(params.metadata || {}) };
    delete cleanMetadata.apiKey;
    delete cleanMetadata.secret;
    delete cleanMetadata.password;

    const insertData: Record<string, any> = {
      business_id: params.businessId || null,
      conversation_id: params.conversationId || null,
      provider: params.provider,
      model: params.model,
      fallback_used: params.fallbackUsed ?? false,
      prompt_tokens_estimate: params.promptTokensEstimate || 0,
      response_tokens_estimate: params.responseTokensEstimate || 0,
      latency_ms: params.latencyMs,
      status: params.status,
      error_message: params.errorMessage || null,
      metadata: {
        ...cleanMetadata,
        feature_source: params.featureSource || null,
      },
      feature_source: params.featureSource || null,
    };

    // 2. Database Log (Try with feature_source column, fallback to metadata JSONB on missing column)
    const { error } = await supabase.from("ai_interaction_logs").insert(insertData);
    
    if (error) {
      if (error.message?.includes('column "feature_source" does not exist') || error.code === "42703") {
        // Fallback: Remove the column parameter and save only inside metadata JSONB
        const fallbackData = { ...insertData };
        delete fallbackData.feature_source;
        
        const { error: fallbackError } = await supabase.from("ai_interaction_logs").insert(fallbackData);
        if (fallbackError) {
          console.error("[AI Logging Error] Fallback insertion failed:", fallbackError);
        }
      } else {
        console.error("[AI Logging Error] Failed to write database log:", error);
      }
    }
  } catch (err) {
    console.error("[AI Logging Error] Failed to write interaction log:", err);
  }
}
