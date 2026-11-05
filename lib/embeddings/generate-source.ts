import "server-only";

import { createServiceClient } from "@/utils/supabase/service";
import { generateEmbedding, generateEmbeddingsBatch } from "@/lib/vertex/embeddings";
import {
  chunkSourceText,
  hashContent,
  estimateTokens,
  type SourceChunk,
} from "@/lib/embeddings/chunker";
import { getEmbeddingProviderConfig } from "@/lib/ai/engine/config";

const REQUIRED_DIMENSIONS = 768;
const EMBEDDING_BATCH_SIZE = 20;
const INSERT_BATCH_SIZE = 25;
const DELETE_BATCH_SIZE = 100;

interface ExistingChunk {
  id: string;
  content: string | null;
  embedding: unknown;
  metadata: Record<string, any> | null;
}

function parseEmbedding(value: unknown): number[] | null {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed) || parsed.length !== REQUIRED_DIMENSIONS) return null;
  if (parsed.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) return null;

  return parsed as number[];
}

async function embedTexts(
  texts: string[],
  businessId: string
): Promise<number[][]> {
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    try {
      const batchVectors = await generateEmbeddingsBatch(
        batch,
        businessId,
        "embeddings_generation"
      );
      vectors.push(...batchVectors);
    } catch (batchError: any) {
      console.warn(
        `[Embeddings] Batch generation failed (${batchError?.message || batchError}). Retrying individually.`
      );

      for (const text of batch) {
        vectors.push(
          await generateEmbedding(text, businessId, "embeddings_generation")
        );
      }
    }
  }

  if (vectors.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: requested ${texts.length} but received ${vectors.length}.`
    );
  }

  return vectors;
}

export function buildReuseMap(existingChunks: ExistingChunk[]): Map<string, number[]> {
  const reuse = new Map<string, number[]>();

  for (const chunk of existingChunks) {
    if (!chunk.content) continue;

    const vector = parseEmbedding(chunk.embedding);
    if (!vector) continue;

    const hash = chunk.metadata?.content_hash || hashContent(chunk.content);
    if (!reuse.has(hash)) {
      reuse.set(hash, vector);
    }
  }

  return reuse;
}

/**
 * Returns how many chunks for this source still need a fresh embedding.
 * Existing chunks are reused when their content hash and vector are valid.
 */
export async function countChunksNeedingEmbedding(
  sourceId: string,
  businessId: string
): Promise<number | null> {
  const supabase = createServiceClient();
  const { data: source, error } = await supabase
    .from("knowledge_sources")
    .select("content")
    .eq("id", sourceId)
    .eq("business_id", businessId)
    .single();

  if (error || !source?.content) return null;

  const records = chunkSourceText(source.content);
  if (records.length === 0) return 0;

  const { data: existingChunks, error: chunksError } = await supabase
    .from("knowledge_chunks")
    .select("id, content, embedding, metadata")
    .eq("source_id", sourceId)
    .eq("business_id", businessId);

  if (chunksError) return null;

  const reuse = buildReuseMap((existingChunks || []) as ExistingChunk[]);
  return records.filter((record) => !reuse.has(record.contentHash)).length;
}

async function deleteStaleChunks(
  sourceId: string,
  businessId: string,
  keepIds: Set<string>
): Promise<void> {
  const supabase = createServiceClient();
  const { data: currentRows, error } = await supabase
    .from("knowledge_chunks")
    .select("id")
    .eq("source_id", sourceId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Failed to read existing knowledge chunks: ${error.message}`);
  }

  const staleIds = (currentRows || [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.has(id));

  for (let i = 0; i < staleIds.length; i += DELETE_BATCH_SIZE) {
    const batch = staleIds.slice(i, i + DELETE_BATCH_SIZE);
    const { error: deleteError } = await supabase
      .from("knowledge_chunks")
      .delete()
      .in("id", batch);

    if (deleteError) {
      throw new Error(`Failed to remove stale knowledge chunks: ${deleteError.message}`);
    }
  }
}

/**
 * Rebuilds the vector index for one source without destroying the previous
 * index until every replacement chunk has been stored successfully.
 */
export async function generateEmbeddingsForSourceInternal(sourceId: string, businessId: string) {
  const supabase = createServiceClient();
  const { data: source, error: fetchError } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", sourceId)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !source) return { error: "Knowledge source not found." };
  if (!source.content) return { error: "Source has no content to embed." };

  const records = chunkSourceText(source.content);
  if (records.length === 0) {
    const updatedMetadata = {
      ...(source.metadata || {}),
      embedded: false,
      embedding_status: "failed",
      chunk_count: 0,
      embedding_error:
        "No usable text chunks were found. Add more source content or reprocess the website.",
    };

    await supabase
      .from("knowledge_sources")
      .update({ metadata: updatedMetadata })
      .eq("id", sourceId)
      .eq("business_id", businessId);

    return { error: "No usable text was found to embed." };
  }

  const { data: existingChunks, error: chunksError } = await supabase
    .from("knowledge_chunks")
    .select("id, content, embedding, metadata")
    .eq("source_id", sourceId)
    .eq("business_id", businessId);

  if (chunksError) {
    return { error: `Failed to read existing knowledge chunks: ${chunksError.message}` };
  }

  const reuse = buildReuseMap((existingChunks || []) as ExistingChunk[]);
  const recordsNeedingEmbedding: SourceChunk[] = records.filter(
    (record) => !reuse.has(record.contentHash)
  );

  const providerConfig = await getEmbeddingProviderConfig();
  const indexedAt = new Date().toISOString();
  const batchId = crypto.randomUUID();
  const insertedIds: string[] = [];

  try {
    const freshVectors = recordsNeedingEmbedding.length
      ? await embedTexts(
          recordsNeedingEmbedding.map((record) => record.content),
          businessId
        )
      : [];

    const freshVectorByHash = new Map<string, number[]>();
    recordsNeedingEmbedding.forEach((record, index) => {
      freshVectorByHash.set(record.contentHash, freshVectors[index]);
    });

    const rows = records.map((record, index) => {
      const vector =
        reuse.get(record.contentHash) || freshVectorByHash.get(record.contentHash);

      if (!vector) {
        throw new Error(`Missing embedding for chunk ${index} of source ${sourceId}.`);
      }

      return {
        business_id: businessId,
        source_id: sourceId,
        content: record.content,
        embedding: vector,
        chunk_index: index,
        token_estimate: estimateTokens(record.content),
        metadata: {
          source_type: source.type,
          source_title: source.title,
          source_url: source.source_url || record.pageUrl || null,
          page_url: record.pageUrl,
          page_title: record.pageTitle,
          section_heading: record.sectionHeading,
          content_hash: record.contentHash,
          chunk_index: index,
          token_estimate: estimateTokens(record.content),
          embedding_provider: providerConfig.provider,
          embedding_model: providerConfig.model,
          indexed_at: indexedAt,
          reindex_batch_id: batchId,
          embedding_reused: reuse.has(record.contentHash),
        },
      };
    });

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
      const { data: inserted, error: insertError } = await supabase
        .from("knowledge_chunks")
        .insert(batch)
        .select("id");

      if (insertError) {
        throw new Error(`Insert failed: ${insertError.message}`);
      }

      inserted?.forEach((row) => insertedIds.push(row.id));
    }

    // Only after every replacement is stored do we remove the old index.
    const keepIds = new Set(insertedIds);
    await deleteStaleChunks(sourceId, businessId, keepIds);

    const updatedMetadata = {
      ...(source.metadata || {}),
      embedded: true,
      embedding_status: "completed",
      embedded_at: indexedAt,
      chunk_count: records.length,
      embeddings_generated: recordsNeedingEmbedding.length,
      embeddings_reused: records.length - recordsNeedingEmbedding.length,
      embedding_provider: providerConfig.provider,
      embedding_model: providerConfig.model,
      indexed_batch_id: batchId,
      embedding_error: null,
    };

    await supabase
      .from("knowledge_sources")
      .update({ metadata: updatedMetadata })
      .eq("id", sourceId)
      .eq("business_id", businessId);

    return {
      success: true,
      chunkCount: records.length,
      embeddingsGenerated: recordsNeedingEmbedding.length,
      embeddingsReused: records.length - recordsNeedingEmbedding.length,
    };
  } catch (error: any) {
    // Remove any partially inserted replacement rows; the previous index is
    // still intact because it is deleted only after all inserts succeed.
    for (let i = 0; i < insertedIds.length; i += DELETE_BATCH_SIZE) {
      const batch = insertedIds.slice(i, i + DELETE_BATCH_SIZE);
      await supabase.from("knowledge_chunks").delete().in("id", batch);
    }

    await supabase
      .from("knowledge_sources")
      .update({
        metadata: {
          ...(source.metadata || {}),
          embedding_status: "failed",
          embedding_error: error?.message || String(error),
          embedding_failed_at: new Date().toISOString(),
        },
      })
      .eq("id", sourceId)
      .eq("business_id", businessId);

    console.error(`[Embeddings] Failed to index source ${sourceId}:`, error);
    return { error: error?.message || "Failed to generate embeddings." };
  }
}
