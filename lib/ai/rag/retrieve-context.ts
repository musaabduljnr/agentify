import "server-only";
import { generateEmbedding } from "../engine/embeddings";
import { createServiceClient } from "@/utils/supabase/service";
import { classifyQueryIntent, type QueryIntent } from "../intent/classify-query";
import { selectKnowledgeChunks } from "./select-chunks";
import { formatContext } from "./build-context";
import { filterCurrentKnowledgeChunks } from "@/lib/knowledge/lifecycle";
import { type RetrievedChunk } from "./types";
import { type FeatureSource } from "../logs/ai-logs";
import { type ChatMessage } from "../engine/types";

export type { RetrievedChunk } from "./types";

export interface RetrievalDiagnostics {
  query: string;
  expandedQuery: string;
  intent: QueryIntent;
  candidates: number;
  aboveThreshold: number;
  finalCount: number;
  topSimilarity: number;
  dynamicLimit: number;
  staleExcluded?: number;
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

    // 2. Query Supabase vector match. The RPC only returns chunks that belong
    // to the source's current, successfully indexed version.
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

    // 3. Defence in depth: reject any row that does not describe the source's
    // current ready version, even if it slipped through the database filter.
    const currentChunks = filterCurrentKnowledgeChunks(rawChunks);
    diagnostics.staleExcluded = rawChunks.length - currentChunks.length;

    // 4. Apply threshold, deduplication, intent reranking, and dynamic limit.
    const selection = selectKnowledgeChunks(currentChunks, {
      minSimilarity,
      intent,
      query: expandedQuery,
    });

    diagnostics.aboveThreshold = selection.aboveThreshold;
    diagnostics.topSimilarity = selection.topSimilarity;
    diagnostics.dynamicLimit = selection.dynamicLimit;
    diagnostics.finalCount = selection.chunks.length;

    const formattedContext = formatContext(selection.chunks);

    if (selection.chunks.length === 0) {
      console.warn(
        `[RAG] No chunks passed the ${minSimilarity} threshold for business ${businessId}. ` +
          `Candidates: ${rawChunks.length}, stale excluded: ${diagnostics.staleExcluded}, query: "${expandedQuery}"`
      );
    }

    return {
      chunks: selection.chunks,
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
