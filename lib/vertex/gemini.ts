import { getChatProviderConfig } from "@/lib/ai/engine-config";
import { generateGeminiChat } from "@/lib/ai/providers/gemini";
import { generateOpenRouterChat } from "@/lib/ai/providers/openrouter";
import { generateGroqChat } from "@/lib/ai/providers/groq";
import { generateVertexChat } from "@/lib/ai/providers/vertex";

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
}: {
  systemInstruction: string;
  userMessage: string;
  history?: { role: "user" | "model"; content: string }[];
  temperature?: number;
}): Promise<string> {
  const config = await getChatProviderConfig();
  
  const primaryProvider = config.provider || "gemini";
  const primaryModel = config.model || "gemini-2.5-flash";

  console.log(
    `[AI Engine] Routing chat generation to primary provider: ${primaryProvider} (${primaryModel})`
  );

  async function callProvider(prov: string, mod: string): Promise<string> {
    switch (prov) {
      case "gemini":
        return generateGeminiChat({
          model: mod,
          systemInstruction,
          userMessage,
          history,
          temperature,
        });
      case "openrouter":
        return generateOpenRouterChat({
          model: mod,
          systemInstruction,
          userMessage,
          history,
          temperature,
        });
      case "groq":
        return generateGroqChat({
          model: mod,
          systemInstruction,
          userMessage,
          history,
          temperature,
        });
      case "vertex":
        return generateVertexChat({
          model: mod,
          systemInstruction,
          userMessage,
          history,
          temperature,
        });
      default:
        throw new Error(`Unsupported AI chat provider: ${prov}`);
    }
  }

  try {
    return await callProvider(primaryProvider, primaryModel);
  } catch (error: any) {
    console.error(
      `[AI Engine Error] Primary provider '${primaryProvider}' failed: ${
        error.message || JSON.stringify(error)
      }`
    );

    let fallbackProvider = config.fallbackProvider;
    let fallbackModel = config.fallbackModel;

    // Dynamically fallback if the configured fallback is missing, or identical to the primary provider
    if (!fallbackProvider || fallbackProvider === primaryProvider) {
      if (process.env.OPENROUTER_API_KEY && primaryProvider !== "openrouter") {
        fallbackProvider = "openrouter";
        fallbackModel = "openai/gpt-oss-20b:free";
        console.log(
          `[AI Engine Fallback] Primary and fallback are identical or missing. Dynamically re-routing failover to OpenRouter: ${fallbackProvider} (${fallbackModel})`
        );
      } else if (process.env.GROQ_API_KEY && primaryProvider !== "groq") {
        fallbackProvider = "groq";
        fallbackModel = "llama-3.3-70b-versatile";
        console.log(
          `[AI Engine Fallback] Primary and fallback are identical or missing. Dynamically re-routing failover to Groq: ${fallbackProvider} (${fallbackModel})`
        );
      }
    }

    if (fallbackProvider && fallbackProvider !== primaryProvider) {
      console.log(
        `[AI Engine Fallback] Initiating failover routing to: ${fallbackProvider} (${fallbackModel})`
      );
      try {
        return await callProvider(fallbackProvider, fallbackModel || "");
      } catch (fallbackError: any) {
        console.error(
          `[AI Engine Fallback Error] Failover provider '${fallbackProvider}' also failed: ${
            fallbackError.message || JSON.stringify(fallbackError)
          }`
        );
        throw new Error(
          `Both primary (${primaryProvider}) and fallback (${fallbackProvider}) AI engines failed to generate response. Primary: ${error.message}. Fallback: ${fallbackError.message}`
        );
      }
    }

    // Rethrow primary error if no fallback is available
    throw error;
  }
}
