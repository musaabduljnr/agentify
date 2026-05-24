import { createServiceClient } from "@/utils/supabase/service";

export interface AIEngineSettings {
  id?: string;
  provider: "gemini" | "openrouter" | "vertex" | "groq";
  chat_model: string;
  embedding_provider: "gemini" | "vertex";
  embedding_model: string;
  fallback_provider: "gemini" | "openrouter" | "vertex" | "groq";
  fallback_chat_model: string;
  is_active: boolean;
}

/**
 * Loads the active AI configuration from the database.
 * Uses service role client to bypass RLS so both anonymous widget chats
 * and authenticated dashboards can read setting values safely on the server.
 */
export async function getActiveAIEngineSettings(): Promise<AIEngineSettings> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("ai_engine_settings")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      // Safe fallback if table is empty or query errors
      return {
        provider: "gemini",
        chat_model: "gemini-2.5-flash",
        embedding_provider: "gemini",
        embedding_model: "gemini-embedding-001",
        fallback_provider: "openrouter",
        fallback_chat_model: "openai/gpt-oss-20b:free",
        is_active: true,
      };
    }

    return data as AIEngineSettings;
  } catch (error) {
    console.error("getActiveAIEngineSettings error:", error);
    return {
      provider: "gemini",
      chat_model: "gemini-2.5-flash",
      embedding_provider: "gemini",
      embedding_model: "gemini-embedding-001",
      fallback_provider: "openrouter",
      fallback_chat_model: "openai/gpt-oss-20b:free",
      is_active: true,
    };
  }
}

export async function getChatProviderConfig() {
  const settings = await getActiveAIEngineSettings();
  return {
    provider: settings.provider,
    model: settings.chat_model,
    fallbackProvider: settings.fallback_provider,
    fallbackModel: settings.fallback_chat_model,
  };
}

export async function getEmbeddingProviderConfig() {
  const settings = await getActiveAIEngineSettings();
  return {
    provider: settings.embedding_provider,
    model: settings.embedding_model,
  };
}
