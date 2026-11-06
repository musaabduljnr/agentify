import { scoreChunkRelevance } from "./chunk-scoring";
import { type QueryIntent } from "../intent/classify-query";
import { type RetrievedChunk } from "./types";

const COMPOUND_QUERY_PATTERN = /\b(?:and|also|plus|as well as|both)\b/i;

export interface ChunkSelection {
  chunks: RetrievedChunk[];
  aboveThreshold: number;
  topSimilarity: number;
  dynamicLimit: number;
}

/**
 * Applies the retrieval policy after the vector search returns candidates:
 * similarity threshold, content deduplication, intent reranking, and the
 * dynamic context window. Kept pure so stale-vs-current fixtures can exercise
 * the exact selection that production uses.
 */
export function selectKnowledgeChunks(
  rawChunks: RetrievedChunk[],
  params: {
    minSimilarity: number;
    intent: QueryIntent;
    query: string;
  }
): ChunkSelection {
  const { minSimilarity, intent, query } = params;

  const filtered = rawChunks.filter((chunk) => chunk.similarity >= minSimilarity);

  const seenContents = new Set<string>();
  const deduplicated: RetrievedChunk[] = [];

  for (const chunk of filtered) {
    const normalizedContent = chunk.content.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seenContents.has(normalizedContent)) {
      seenContents.add(normalizedContent);
      deduplicated.push(chunk);
    }
  }

  const scored = deduplicated.map((chunk) => {
    const boost = scoreChunkRelevance(chunk, intent, query);
    return {
      ...chunk,
      rerankScore: chunk.similarity + boost,
    };
  });

  scored.sort((a, b) => b.rerankScore - a.rerankScore);

  const topSimilarity = scored.length > 0 ? scored[0].similarity : 0;
  const isHighConfidence = topSimilarity >= 0.70;
  const isCompound =
    COMPOUND_QUERY_PATTERN.test(query) || (query.match(/\?/g) || []).length > 1;
  const dynamicLimit = isHighConfidence && !isCompound ? 2 : 5;

  const chunks = scored
    .slice(0, dynamicLimit)
    .map(({ rerankScore, ...rest }) => rest as RetrievedChunk);

  return {
    chunks,
    aboveThreshold: filtered.length,
    topSimilarity,
    dynamicLimit,
  };
}
