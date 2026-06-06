import { generateChatResponse } from "@/lib/ai/engine/chat";
import { type FeatureSource } from "@/lib/ai/logs/ai-logs";

/**
 * Generates a response from the dynamically selected AI provider.
 * Maintains a stable signature for full backward compatibility, with
 * automatic failover routing to the fallback provider on errors.
 */
export async function generateGeminiResponse({
  systemInstruction,
  userMessage,
  history = [],
  temperature = 0.4,
  businessId,
  featureSource,
}: {
  systemInstruction: string;
  userMessage: string;
  history?: { role: "user" | "model"; content: string }[];
  temperature?: number;
  businessId?: string;
  featureSource?: FeatureSource;
}): Promise<string> {
  const mappedHistory = history.map(h => ({
    role: h.role,
    content: h.content
  }));

  const response = await generateChatResponse({
    systemInstruction,
    userMessage,
    history: mappedHistory,
    temperature,
    businessId,
    featureSource,
  });

  return response.text;
}
