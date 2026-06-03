import "server-only";
import { getEmbeddingProviderConfig } from "./config";
import { generateGeminiEmbedding, generateGeminiEmbeddingsBatch } from "../providers/gemini";
import { generateVertexEmbedding } from "../providers/vertex";
import { executeWithRetryAndTimeout } from "./fallback";
import { estimateTokens } from "@/lib/embeddings/chunker";
import { writeAIEngineLog } from "../logs/ai-logs";

const MAX_CHAR_LIMIT = 10000;
const REQUIRED_DIMENSIONS = 768;

function normalizeText(text: string): string {
  if (!text) return "";
  // Trim excessive whitespace and newlines
  let cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length > MAX_CHAR_LIMIT) {
    cleaned = cleaned.slice(0, MAX_CHAR_LIMIT);
  }
  return cleaned;
}

function ensureCorrectDimensions(vector: number[]): number[] {
  if (vector.length === REQUIRED_DIMENSIONS) {
    return vector;
  }
  if (vector.length > REQUIRED_DIMENSIONS) {
    return vector.slice(0, REQUIRED_DIMENSIONS);
  }
  // Pad with zeros if too small
  const padded = [...vector];
  while (padded.length < REQUIRED_DIMENSIONS) {
    padded.push(0);
  }
  return padded;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new Error("Cannot generate embedding for empty or blank text.");
  }

  const config = await getEmbeddingProviderConfig();
  const provider = config.provider || "gemini";
  const model = config.model || "gemini-embedding-001";
  
  const startTime = Date.now();
  const tokenEstimate = estimateTokens(normalized);

  try {
    const rawVector = await executeWithRetryAndTimeout(
      provider,
      async () => {
        switch (provider) {
          case "gemini":
            return generateGeminiEmbedding({ model, text: normalized });
          case "vertex":
            return generateVertexEmbedding({ model, text: normalized });
          default:
            throw new Error(`Unsupported AI embedding provider: ${provider}`);
        }
      },
      { maxRetries: 2 }
    );

    const vector = ensureCorrectDimensions(rawVector);
    const latency = Date.now() - startTime;

    // Log embedding generation
    await writeAIEngineLog({
      provider,
      model,
      latencyMs: latency,
      status: "success",
      promptTokensEstimate: tokenEstimate,
      metadata: { action: "generate_embedding", textLength: normalized.length },
    });

    return vector;
  } catch (error: any) {
    const latency = Date.now() - startTime;
    await writeAIEngineLog({
      provider,
      model,
      latencyMs: latency,
      status: "failed",
      errorMessage: error.message || String(error),
      promptTokensEstimate: tokenEstimate,
      metadata: { action: "generate_embedding", failed: true },
    });
    throw error;
  }
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const cleanedTexts = texts.map((t) => normalizeText(t)).filter((t) => t.length > 0);
  if (cleanedTexts.length === 0) return [];

  const config = await getEmbeddingProviderConfig();
  const provider = config.provider || "gemini";
  const model = config.model || "gemini-embedding-001";

  const startTime = Date.now();
  const tokenEstimate = cleanedTexts.reduce((sum, t) => sum + estimateTokens(t), 0);

  try {
    let rawVectors: number[][] = [];

    if (provider === "gemini") {
      // Gemini supports batching natively
      rawVectors = await executeWithRetryAndTimeout(
        provider,
        () => generateGeminiEmbeddingsBatch({ model, texts: cleanedTexts }),
        { maxRetries: 2 }
      );
    } else {
      // Process sequentially with concurrency limit for non-native providers
      const CONCURRENCY_LIMIT = 3;
      rawVectors = [];
      
      for (let i = 0; i < cleanedTexts.length; i += CONCURRENCY_LIMIT) {
        const batch = cleanedTexts.slice(i, i + CONCURRENCY_LIMIT);
        const promises = batch.map((text) =>
          executeWithRetryAndTimeout(
            provider,
            () => {
              if (provider === "vertex") {
                return generateVertexEmbedding({ model, text });
              }
              throw new Error(`Unsupported AI embedding provider: ${provider}`);
            },
            { maxRetries: 2 }
          )
        );
        const results = await Promise.all(promises);
        rawVectors.push(...results);
      }
    }

    const vectors = rawVectors.map((v) => ensureCorrectDimensions(v));
    const latency = Date.now() - startTime;

    await writeAIEngineLog({
      provider,
      model,
      latencyMs: latency,
      status: "success",
      promptTokensEstimate: tokenEstimate,
      metadata: { action: "generate_embeddings_batch", batchSize: cleanedTexts.length },
    });

    return vectors;
  } catch (error: any) {
    const latency = Date.now() - startTime;
    await writeAIEngineLog({
      provider,
      model,
      latencyMs: latency,
      status: "failed",
      errorMessage: error.message || String(error),
      promptTokensEstimate: tokenEstimate,
      metadata: { action: "generate_embeddings_batch", failed: true },
    });
    throw error;
  }
}
