import { generateEmbedding as engineGenerateEmbedding } from "@/lib/ai/engine/embeddings";

/**
 * Generates vector embeddings using the dynamically active embedding model provider.
 * Maintains stable public signature for backward-compatible client integrations.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return engineGenerateEmbedding(text);
}
