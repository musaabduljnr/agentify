import "server-only";
import { type RetrievedChunk } from "./retrieve-context";
import { type QueryIntent } from "../intent/classify-query";
import { scoreChunkRelevance } from "./chunk-scoring";

/**
 * Reranks a list of retrieved chunks based on query intent alignment.
 */
export function rerankContextChunks(
  chunks: RetrievedChunk[],
  intent: QueryIntent,
  query: string
): RetrievedChunk[] {
  const scored = chunks.map((chunk) => {
    const boost = scoreChunkRelevance(chunk, intent, query);
    return {
      ...chunk,
      rerankScore: chunk.similarity + boost,
    };
  });

  scored.sort((a, b) => b.rerankScore - a.rerankScore);

  return scored.map(({ rerankScore, ...rest }) => rest);
}
