import { getEmbeddingProviderConfig } from "@/lib/ai/engine-config";
import { generateGeminiEmbedding } from "@/lib/ai/providers/gemini";
import { generateVertexEmbedding } from "@/lib/ai/providers/vertex";

/**
 * Generates vector embeddings using the dynamically active embedding model provider.
 * Maintains stable public signature for backward-compatible client integrations.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const config = await getEmbeddingProviderConfig();
  const provider = config.provider || "gemini";
  const model = config.model || "gemini-embedding-001";

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[AI Engine] Routing embedding generation request to: ${provider} (${model})`
    );
  }

  switch (provider) {
    case "gemini":
      return generateGeminiEmbedding({ model, text });
    case "vertex":
      return generateVertexEmbedding({ model, text });
    default:
      throw new Error(`Unsupported AI embedding provider: ${provider}`);
  }
}
