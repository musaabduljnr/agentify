import "server-only";
import { generateEmbedding } from "../engine/embeddings";
import { createServiceClient } from "@/utils/supabase/service";
import { classifyQueryIntent, type QueryIntent } from "../intent/classify-query";
import { scoreChunkRelevance } from "./chunk-scoring";
import { formatContext } from "./build-context";
import { type FeatureSource } from "../logs/ai-logs";
import { type ChatMessage } from "../engine/types";

export interface RetrievedChunk {
  id: string;
  source_id: string;
  content: string;
  similarity: number;
  metadata: {
    source_type?: string;
    source_title?: string;
    source_url?: string | null;
    page_url?: string | null;
    page_title?: string | null;
    section_heading?: string | null;
    chunk_index?: number;
    token_estimate?: number;
    content_hash?: string;
    [key: string]: any;
  };
}

export interface RetrievalDiagnostics {
  query: string;
  expandedQuery: string;
  intent: QueryIntent;
  candidates: number;
  aboveThreshold: number;
  finalCount: number;
  topSimilarity: number;
  dynamicLimit: number;
  retrievalError?: string;
}

interface RetrieveContextParams {
  businessId: string;
  query: string;
  matchCount?: number;
  minSimilarity?: number;
  featureSource?: FeatureSource;
  conversationHistory?: ChatMessage[];
}

const FOLLOW_UP_PATTERN = new RegExp(
  "^(?:and|what about|how about|how much|where|when|why|which|who|is it|are they|do you|can you|could you|tell me more|more info|continue)\\b" +
    "|\\b(?:it|that|they|them|this|those|these|there|the same)\\b",
  "i"
);

const COMPOUND_QUERY_PATTERN = /\b(?:and|also|plus|as well as|both)\b/i;

/**
 * Builds the text sent to the embedding model. Short or referential follow-ups
 * ("how much is it?") inherit the previous user turn so retrieval still finds
 * the right evidence.
 */
export function buildRetrievalQuery(query: string, history: ChatMessage[] = []): string {
  const cleaned = query.trim();
  if (!cleaned) return cleaned;

  const previousUserMessages = history
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.content.trim())
    .filter(Boolean);

  const lastUserMessage = previousUserMessages[previousUserMessages.length - 1];
  if (!lastUserMessage) return cleaned;

  if (/^continue\b/i.test(cleaned)) {
    return lastUserMessage.slice(0, 500);
  }

  const isFollowUp = cleaned.length < 45 || FOLLOW_UP_PATTERN.test(cleaned);
  if (!isFollowUp || lastUserMessage === cleaned) {
    return cleaned;
  }

  return `${lastUserMessage}\nFollow-up: ${cleaned}`.slice(0, 500);
}

export async function retrieveBusinessContext(params: RetrieveContextParams): Promise<{
  chunks: RetrievedChunk[];
  formattedContext: string;
  intent: QueryIntent;
  diagnostics: RetrievalDiagnostics;
}> {
  const {
    businessId,
    query,
    matchCount = 8,
    minSimilarity = 0.55,
    featureSource,
    conversationHistory = [],
  } = params;

  const expandedQuery = buildRetrievalQuery(query, conversationHistory);
  const intent = classifyQueryIntent(expandedQuery);

  const diagnostics: RetrievalDiagnostics = {
    query,
    expandedQuery,
    intent,
    candidates: 0,
    aboveThreshold: 0,
    finalCount: 0,
    topSimilarity: 0,
    dynamicLimit: 5,
  };

  try {
    // 1. Generate query embedding
    const queryEmbedding = await generateEmbedding(expandedQuery, businessId, featureSource);

    // 2. Query Supabase vector match
    const supabase = createServiceClient();
    const { data: dbChunks, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: queryEmbedding,
      match_business_id: businessId,
      match_count: matchCount * 2, // Fetch double the match count for reranking/deduplication
    });

    if (error) {
      diagnostics.retrievalError = error.message;
      console.error("[RAG Error] match_knowledge_chunks query failed:", error.message);
      return { chunks: [], formattedContext: formatContext([]), intent, diagnostics };
    }

    const rawChunks = (dbChunks || []) as RetrievedChunk[];
    diagnostics.candidates = rawChunks.length;

    // 3. Filter by similarity threshold
    const filtered = rawChunks.filter((chunk) => chunk.similarity >= minSimilarity);
    diagnostics.aboveThreshold = filtered.length;

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
      const boost = scoreChunkRelevance(chunk, intent, expandedQuery);
      return {
        ...chunk,
        rerankScore: chunk.similarity + boost,
      };
    });

    // Sort by boosted score
    scored.sort((a, b) => b.rerankScore - a.rerankScore);

    // Dynamic RAG slicing for token optimization. Compound questions keep the
    // wider window so each part of the question still has evidence.
    const topSimilarity = scored.length > 0 ? scored[0].similarity : 0;
    const isHighConfidence = topSimilarity >= 0.70;
    const isCompound = COMPOUND_QUERY_PATTERN.test(expandedQuery) || (expandedQuery.match(/\?/g) || []).length > 1;
    const dynamicLimit = isHighConfidence && !isCompound ? 2 : 5;

    const finalChunks = scored.slice(0, dynamicLimit).map(({ rerankScore, ...rest }) => rest);

    diagnostics.topSimilarity = topSimilarity;
    diagnostics.dynamicLimit = dynamicLimit;
    diagnostics.finalCount = finalChunks.length;

    // 6. Format structured context
    const formattedContext = formatContext(finalChunks);

    if (finalChunks.length === 0) {
      console.warn(
        `[RAG] No chunks passed the ${minSimilarity} threshold for business ${businessId}. ` +
          `Candidates: ${rawChunks.length}, query: "${expandedQuery}"`
      );
    }

    return {
      chunks: finalChunks,
      formattedContext,
      intent,
      diagnostics,
    };
  } catch (err: any) {
    diagnostics.retrievalError = err?.message || String(err);
    console.error("[RAG Exception] Failed to retrieve business context:", err);
    return { chunks: [], formattedContext: formatContext([]), intent, diagnostics };
  }
}
