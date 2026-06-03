import "server-only";
import { createServiceClient } from "@/utils/supabase/service";

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
}

export async function writeAIEngineLog(params: LogParams): Promise<void> {
  try {
    const supabase = createServiceClient();
    
    // Clean metadata of secrets if any
    const cleanMetadata = { ...(params.metadata || {}) };
    delete cleanMetadata.apiKey;
    delete cleanMetadata.secret;
    delete cleanMetadata.password;

    await supabase.from("ai_interaction_logs").insert({
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
      metadata: cleanMetadata,
    });
  } catch (err) {
    console.error("[AI Logging Error] Failed to write interaction log:", err);
  }
}
