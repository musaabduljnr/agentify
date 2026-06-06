import { generateEmbedding as engineGenerateEmbedding } from "@/lib/ai/engine/embeddings";
import { type FeatureSource } from "@/lib/ai/logs/ai-logs";

/**
 * Generates vector embeddings using the dynamically active embedding model provider.
 * Maintains stable public signature for backward-compatible client integrations.
 */
export async function generateEmbedding(
  text: string,
  businessId?: string,
  featureSource?: FeatureSource
): Promise<number[]> {
  return engineGenerateEmbedding(text, businessId, featureSource);
}
