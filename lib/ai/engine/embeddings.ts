import "server-only";
import { getEmbeddingProviderConfig } from "./config";
import { generateGeminiEmbedding, generateGeminiEmbeddingsBatch } from "../providers/gemini";
import { generateVertexEmbedding } from "../providers/vertex";
import { executeWithRetryAndTimeout } from "./fallback";
import { estimateTokens } from "@/lib/embeddings/chunker";
import { writeAIEngineLog, type FeatureSource } from "../logs/ai-logs";

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

export function assertCorrectDimensions(
  vector: number[],
  provider: string,
  model: string
): number[] {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error(`Embedding provider ${provider}/${model} returned an empty vector.`);
  }

  if (vector.length !== REQUIRED_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: ${provider}/${model} returned ${vector.length} values, ` +
        `but the knowledge base requires ${REQUIRED_DIMENSIONS}. ` +
        `Configure the embedding model with outputDimensionality=${REQUIRED_DIMENSIONS} and re-index.`
    );
  }

  if (vector.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`Embedding provider ${provider}/${model} returned non-numeric values.`);
  }

  return vector;
}

export async function generateEmbedding(
  text: string,
  businessId?: string,
  featureSource?: FeatureSource
): Promise<number[]> {
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
      (signal) => {
        switch (provider) {
          case "gemini":
            return generateGeminiEmbedding({ model, text: normalized, signal });
          case "vertex":
            return generateVertexEmbedding({ model, text: normalized, signal });
          default:
            throw new Error(`Unsupported AI embedding provider: ${provider}`);
        }
      },
      { maxRetries: 2 }
    );

    const vector = assertCorrectDimensions(rawVector, provider, model);
    const latency = Date.now() - startTime;

    // Log embedding generation
    await writeAIEngineLog({
      businessId,
      provider,
      model,
      latencyMs: latency,
      status: "success",
      promptTokensEstimate: tokenEstimate,
      metadata: { action: "generate_embedding", textLength: normalized.length },
      featureSource,
    });

    return vector;
  } catch (error: any) {
    const latency = Date.now() - startTime;
    await writeAIEngineLog({
      businessId,
      provider,
      model,
      latencyMs: latency,
      status: "failed",
      errorMessage: error.message || String(error),
      promptTokensEstimate: tokenEstimate,
      metadata: { action: "generate_embedding", failed: true },
      featureSource,
    });
    throw error;
  }
}

export async function generateEmbeddingsBatch(
  texts: string[],
  businessId?: string,
  featureSource?: FeatureSource
): Promise<number[][]> {
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
        (signal) => generateGeminiEmbeddingsBatch({ model, texts: cleanedTexts, signal }),
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
            (signal) => {
              if (provider === "vertex") {
                return generateVertexEmbedding({ model, text, signal });
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

    if (rawVectors.length !== cleanedTexts.length) {
      throw new Error(
        `Embedding batch size mismatch: requested ${cleanedTexts.length} embeddings but received ${rawVectors.length}.`
      );
    }

    const vectors = rawVectors.map((vector) => assertCorrectDimensions(vector, provider, model));
    const latency = Date.now() - startTime;

    await writeAIEngineLog({
      businessId,
      provider,
      model,
      latencyMs: latency,
      status: "success",
      promptTokensEstimate: tokenEstimate,
      metadata: { action: "generate_embeddings_batch", batchSize: cleanedTexts.length },
      featureSource,
    });

    return vectors;
  } catch (error: any) {
    const latency = Date.now() - startTime;
    await writeAIEngineLog({
      businessId,
      provider,
      model,
      latencyMs: latency,
      status: "failed",
      errorMessage: error.message || String(error),
      promptTokensEstimate: tokenEstimate,
      metadata: { action: "generate_embeddings_batch", failed: true },
      featureSource,
    });
    throw error;
  }
}
