import "server-only";
import { createServiceClient } from "@/utils/supabase/service";
import { type AIProvider } from "./types";

export interface AIEngineSettings {
  id?: string;
  provider: AIProvider;
  chat_model: string;
  embedding_provider: "gemini" | "vertex";
  embedding_model: string;
  fallback_provider: AIProvider;
  fallback_chat_model: string;
  is_active: boolean;
}

const DEFAULT_SETTINGS: AIEngineSettings = {
  provider: "gemini",
  chat_model: "gemini-2.5-flash",
  embedding_provider: "gemini",
  embedding_model: "gemini-embedding-001",
  fallback_provider: "openrouter",
  fallback_chat_model: "openai/gpt-oss-20b:free",
  is_active: true,
};

export async function getActiveAIEngineSettings(): Promise<AIEngineSettings> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("ai_engine_settings")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_SETTINGS;
    }

    return data as AIEngineSettings;
  } catch (error) {
    console.error("getActiveAIEngineSettings error, using defaults:", error);
    return DEFAULT_SETTINGS;
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
