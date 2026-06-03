import "server-only";
import { type ChatParams, type ChatResponse, type AIProvider } from "./types";
import { getChatProviderConfig } from "./config";
import { executeWithRetryAndTimeout } from "./fallback";
import { generateGeminiChat } from "../providers/gemini";
import { generateOpenRouterChat } from "../providers/openrouter";
import { generateGroqChat } from "../providers/groq";
import { generateVertexChat } from "../providers/vertex";
import { estimateTokens } from "@/lib/embeddings/chunker";
import { writeAIEngineLog } from "../logs/ai-logs";

export async function generateChatResponse(params: ChatParams): Promise<ChatResponse> {
  const config = await getChatProviderConfig();
  
  const primaryProvider = params.provider || config.provider || "gemini";
  const primaryModel = params.model || config.model || "gemini-2.5-flash";
  const fallbackProvider = config.fallbackProvider || "openrouter";
  const fallbackModel = config.fallbackModel || "openai/gpt-oss-20b:free";

  const systemInstruction = params.systemInstruction;
  const userMessage = params.userMessage;
  const history = params.history || [];
  const temperature = params.temperature ?? 0.4;
  const maxOutputTokens = params.maxOutputTokens ?? 800;
  const timeoutMs = params.timeoutMs ?? 15000;

  const totalInputText = systemInstruction + " " + userMessage + " " + history.map((h) => h.content).join(" ");
  const promptTokensEstimate = estimateTokens(totalInputText);

  let activeProvider = primaryProvider;
  let activeModel = primaryModel;
  let fallbackUsed = false;
  const startTime = Date.now();

  async function callProvider(prov: AIProvider, mod: string): Promise<string> {
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
    // Try primary
    const text = await executeWithRetryAndTimeout(
      primaryProvider,
      () => callProvider(primaryProvider, primaryModel),
      { maxRetries: 2, timeoutMs }
    );

    const latencyMs = Date.now() - startTime;
    const responseTokensEstimate = estimateTokens(text);

    const response: ChatResponse = {
      text,
      provider: primaryProvider,
      model: primaryModel,
      latencyMs,
      fallbackUsed: false,
      promptTokensEstimate,
      responseTokensEstimate,
    };

    // Log success
    await writeAIEngineLog({
      businessId: params.businessId,
      conversationId: params.conversationId,
      provider: primaryProvider,
      model: primaryModel,
      fallbackUsed: false,
      promptTokensEstimate,
      responseTokensEstimate,
      latencyMs,
      status: "success",
      metadata: { temperature },
    });

    return response;
  } catch (primaryError: any) {
    console.error(`[AI Engine] Primary provider ${primaryProvider} failed. Error: ${primaryError.message || primaryError}`);
    
    // Check if we can fallback (avoid fallback if already using fallback provider as primary)
    const canFallback = fallbackProvider && fallbackProvider !== primaryProvider;
    
    if (!canFallback) {
      const latencyMs = Date.now() - startTime;
      await writeAIEngineLog({
        businessId: params.businessId,
        conversationId: params.conversationId,
        provider: primaryProvider,
        model: primaryModel,
        fallbackUsed: false,
        promptTokensEstimate,
        responseTokensEstimate: 0,
        latencyMs,
        status: "failed",
        errorMessage: primaryError.message || String(primaryError),
        metadata: { primaryFailed: true },
      });
      throw primaryError;
    }

    // Try fallback
    fallbackUsed = true;
    activeProvider = fallbackProvider;
    activeModel = fallbackModel;

    try {
      console.log(`[AI Engine] Initiating failover fallback to ${fallbackProvider} (${fallbackModel})...`);
      
      const fallbackStartTime = Date.now();
      const text = await executeWithRetryAndTimeout(
        fallbackProvider,
        () => callProvider(fallbackProvider, fallbackModel),
        { maxRetries: 2, timeoutMs }
      );

      const totalLatency = Date.now() - startTime;
      const responseTokensEstimate = estimateTokens(text);

      const response: ChatResponse = {
        text,
        provider: fallbackProvider,
        model: fallbackModel,
        latencyMs: totalLatency,
        fallbackUsed: true,
        promptTokensEstimate,
        responseTokensEstimate,
      };

      // Log fallback success
      await writeAIEngineLog({
        businessId: params.businessId,
        conversationId: params.conversationId,
        provider: fallbackProvider,
        model: fallbackModel,
        fallbackUsed: true,
        promptTokensEstimate,
        responseTokensEstimate,
        latencyMs: totalLatency,
        status: "fallback_success",
        metadata: { primaryError: primaryError.message || String(primaryError) },
      });

      return response;
    } catch (fallbackError: any) {
      console.error(`[AI Engine] Fallback provider ${fallbackProvider} also failed. Error: ${fallbackError.message || fallbackError}`);
      const latencyMs = Date.now() - startTime;

      // Log critical failure
      await writeAIEngineLog({
        businessId: params.businessId,
        conversationId: params.conversationId,
        provider: fallbackProvider,
        model: fallbackModel,
        fallbackUsed: true,
        promptTokensEstimate,
        responseTokensEstimate: 0,
        latencyMs,
        status: "failed",
        errorMessage: `Primary failed: ${primaryError.message}. Fallback failed: ${fallbackError.message}`,
        metadata: { primaryError: primaryError.message, fallbackError: fallbackError.message },
      });

      throw new Error(
        `Both primary (${primaryProvider}) and fallback (${fallbackProvider}) AI engines failed. ` +
        `Primary: ${primaryError.message}. Fallback: ${fallbackError.message}`
      );
    }
  }
}
