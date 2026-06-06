import "server-only";
import { generateEmbedding } from "../engine/embeddings";
import { createServiceClient } from "@/utils/supabase/service";
import { classifyQueryIntent, type QueryIntent } from "../intent/classify-query";
import { scoreChunkRelevance } from "./chunk-scoring";
import { formatContext } from "./build-context";
import { type FeatureSource } from "../logs/ai-logs";

export interface RetrievedChunk {
  id: string;
  source_id: string;
  content: string;
  similarity: number;
  metadata: {
    source_type?: string;
    source_title?: string;
    section_heading?: string;
    chunk_index?: number;
    token_estimate?: number;
    content_hash?: string;
    [key: string]: any;
  };
}

interface RetrieveContextParams {
  businessId: string;
  query: string;
  matchCount?: number;
  minSimilarity?: number;
  featureSource?: FeatureSource;
}

export async function retrieveBusinessContext(params: RetrieveContextParams): Promise<{
  chunks: RetrievedChunk[];
  formattedContext: string;
  intent: QueryIntent;
}> {
  const { businessId, query, matchCount = 8, minSimilarity = 0.55, featureSource } = params;
  const intent = classifyQueryIntent(query);

  try {
    // 1. Generate query embedding
    const queryEmbedding = await generateEmbedding(query, businessId, featureSource);

    // 2. Query Supabase vector match
    const supabase = createServiceClient();
    const { data: dbChunks, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: queryEmbedding,
      match_business_id: businessId,
      match_count: matchCount * 2, // Fetch double the match count for reranking/deduplication
    });

    if (error) {
      console.error("[RAG Error] match_knowledge_chunks query failed:", error.message);
      return { chunks: [], formattedContext: "", intent };
    }

    const rawChunks = (dbChunks || []) as RetrievedChunk[];

    // 3. Filter by similarity threshold
    let filtered = rawChunks.filter((chunk) => chunk.similarity >= minSimilarity);

    // 4. Deduplicate near-identical chunks
    const seenContents = new Set<string>();
    const deduplicated: RetrievedChunk[] = [];

    for (const chunk of filtered) {
      const normalizedContent = chunk.content.toLowerCase().replace(/\s+/g, " ").trim();
      if (!seenContents.has(normalizedContent)) {
        seenContents.add(normalizedContent);
        deduplicated.push(chunk);
      }
    }

    // 5. Score and rerank chunks based on intent alignment
    const scored = deduplicated.map((chunk) => {
      const boost = scoreChunkRelevance(chunk, intent, query);
      return {
        ...chunk,
        rerankScore: chunk.similarity + boost,
      };
    });

    // Sort by boosted score
    scored.sort((a, b) => b.rerankScore - a.rerankScore);

    // Dynamic RAG slicing for token optimization:
    // If the top match has a similarity >= 0.70 (high confidence), retrieve only 2 chunks.
    // Otherwise (low confidence), retrieve up to 5 chunks to gather broader context.
    const topSimilarity = scored.length > 0 ? scored[0].similarity : 0;
    const isHighConfidence = topSimilarity >= 0.70;
    const dynamicLimit = isHighConfidence ? 2 : 5;

    const finalChunks = scored.slice(0, dynamicLimit).map(({ rerankScore, ...rest }) => rest);

    // 6. Format structured context
    const formattedContext = formatContext(finalChunks);

    return {
      chunks: finalChunks,
      formattedContext,
      intent,
    };
  } catch (err) {
    console.error("[RAG Exception] Failed to retrieve business context:", err);
    return { chunks: [], formattedContext: "", intent };
  }
}
