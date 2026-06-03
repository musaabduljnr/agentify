import "server-only";

export type AIProvider = "gemini" | "openrouter" | "vertex" | "groq";

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface ChatParams {
  provider?: AIProvider;
  model?: string;
  systemInstruction: string;
  userMessage: string;
  history?: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  businessId?: string;
  conversationId?: string;
}

export interface ChatResponse {
  text: string;
  provider: AIProvider;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  promptTokensEstimate: number;
  responseTokensEstimate: number;
  error?: string;
}

export interface EmbeddingParams {
  provider?: "gemini" | "vertex";
  model?: string;
  text: string;
}

export interface BatchEmbeddingParams {
  provider?: "gemini" | "vertex";
  model?: string;
  texts: string[];
}
