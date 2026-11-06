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
import {
  canDeleteChunkForVersion,
  isIndexRunCurrent,
  isReindexingCurrentContent,
} from "@/lib/knowledge/lifecycle";

const REQUIRED_DIMENSIONS = 768;
const EMBEDDING_BATCH_SIZE = 20;
const INSERT_BATCH_SIZE = 25;
const DELETE_BATCH_SIZE = 100;
const STALE_INDEX_RUN_MS = 15 * 60 * 1000;

interface ExistingChunk {
  id: string;
  content: string | null;
  embedding: unknown;
  metadata: Record<string, any> | null;
  source_version?: number | null;
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

/**
 * Removes only chunks at or below the version that was just finalised. Chunks
 * belonging to a newer content version are never touched, so a late job can
 * not delete the current index.
 */
async function deleteStaleChunks(
  sourceId: string,
  businessId: string,
  targetVersion: number,
  keepIds: Set<string>
): Promise<void> {
  const supabase = createServiceClient();
  const { data: currentRows, error } = await supabase
    .from("knowledge_chunks")
    .select("id, source_version")
    .eq("source_id", sourceId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Failed to read existing knowledge chunks: ${error.message}`);
  }

  const staleIds = (currentRows || [])
    .filter(
      (row) =>
        !keepIds.has(row.id as string) &&
        canDeleteChunkForVersion(row.source_version, targetVersion)
    )
    .map((row) => row.id as string);

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

async function deleteInsertedRows(
  supabase: ReturnType<typeof createServiceClient>,
  insertedIds: string[]
) {
  for (let i = 0; i < insertedIds.length; i += DELETE_BATCH_SIZE) {
    const batch = insertedIds.slice(i, i + DELETE_BATCH_SIZE);
    await supabase.from("knowledge_chunks").delete().in("id", batch);
  }
}

/**
 * Rebuilds the vector index for one source. The source's current content
 * version and indexing run id gate every write, so a run that started before a
 * newer update can never mark obsolete content as current.
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

  const targetVersion = Number(source.content_version ?? 1);
  const sourceWasCurrent = isReindexingCurrentContent({
    indexStatus: source.index_status,
    indexedVersion: source.indexed_version,
    contentVersion: targetVersion,
  });

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const staleRunCutoff = new Date(Date.now() - STALE_INDEX_RUN_MS).toISOString();

  const claimPayload: Record<string, any> = {
    index_run_id: runId,
    index_started_at: startedAt,
    index_error: null,
  };

  // Re-indexing unchanged content keeps the previous index readable while the
  // rebuild runs. A content change is already ineligible, so it stays
  // 'indexing' until a complete replacement is stored.
  if (!sourceWasCurrent) {
    claimPayload.index_status = "indexing";
  }

  const { data: claimedRows, error: claimError } = await supabase
    .from("knowledge_sources")
    .update(claimPayload)
    .eq("id", sourceId)
    .eq("business_id", businessId)
    .eq("content_version", targetVersion)
    .or(`index_run_id.is.null,index_started_at.lt.${staleRunCutoff}`)
    .select("id");

  if (claimError) {
    return { error: `Failed to start indexing: ${claimError.message}` };
  }

  if (!claimedRows || claimedRows.length === 0) {
    return {
      error:
        "This knowledge source changed or another indexing run is already in progress. Try again once it finishes.",
    };
  }

  const records = chunkSourceText(source.content);
  if (records.length === 0) {
    const errorMessage =
      "No usable text chunks were found. Add more source content or reprocess the website.";
    const updatedMetadata = sourceWasCurrent
      ? {
          ...(source.metadata || {}),
          embedding_error: errorMessage,
          embedding_failed_at: new Date().toISOString(),
        }
      : {
          ...(source.metadata || {}),
          embedded: false,
          embedding_status: "failed",
          chunk_count: 0,
          embedding_error: errorMessage,
        };

    await supabase
      .from("knowledge_sources")
      .update({
        metadata: updatedMetadata,
        index_status: sourceWasCurrent ? "ready" : "failed",
        index_run_id: null,
        index_started_at: null,
        index_error: errorMessage,
      })
      .eq("id", sourceId)
      .eq("business_id", businessId)
      .eq("content_version", targetVersion)
      .eq("index_run_id", runId);

    return { error: "No usable text was found to embed." };
  }

  const { data: existingChunks, error: chunksError } = await supabase
    .from("knowledge_chunks")
    .select("id, content, embedding, metadata, source_version")
    .eq("source_id", sourceId)
    .eq("business_id", businessId);

  if (chunksError) {
    await supabase
      .from("knowledge_sources")
      .update({
        index_status: sourceWasCurrent ? "ready" : "failed",
        index_run_id: null,
        index_started_at: null,
        index_error: `Failed to read existing knowledge chunks: ${chunksError.message}`,
      })
      .eq("id", sourceId)
      .eq("business_id", businessId)
      .eq("content_version", targetVersion)
      .eq("index_run_id", runId);

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
        source_version: targetVersion,
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
          source_version: targetVersion,
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

    // Verify this run still owns the source's current content version before
    // publishing it. The conditional update below is the authoritative guard;
    // this read provides a clear failure result for a superseded run.
    const { data: currentState, error: stateError } = await supabase
      .from("knowledge_sources")
      .select("content_version, index_run_id, metadata")
      .eq("id", sourceId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (stateError) {
      throw new Error(`Failed to verify indexing state: ${stateError.message}`);
    }

    if (
      !currentState ||
      !isIndexRunCurrent({
        sourceContentVersion: currentState.content_version,
        targetVersion,
        currentRunId: currentState.index_run_id,
        runId,
      })
    ) {
      await deleteInsertedRows(supabase, insertedIds);
      return {
        error:
          "This indexing run was superseded by a newer knowledge update. The newer content is used instead.",
      };
    }

    const updatedMetadata = {
      ...((currentState.metadata as Record<string, any> | null) || source.metadata || {}),
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

    const { data: finalizedRows, error: finalizeError } = await supabase
      .from("knowledge_sources")
      .update({
        metadata: updatedMetadata,
        index_status: "ready",
        indexed_version: targetVersion,
        indexed_at: indexedAt,
        index_run_id: null,
        index_started_at: null,
        index_error: null,
      })
      .eq("id", sourceId)
      .eq("business_id", businessId)
      .eq("content_version", targetVersion)
      .eq("index_run_id", runId)
      .select("id");

    if (finalizeError) {
      throw new Error(`Failed to finalize the knowledge index: ${finalizeError.message}`);
    }

    if (!finalizedRows || finalizedRows.length === 0) {
      await deleteInsertedRows(supabase, insertedIds);
      return {
        error:
          "This indexing run was superseded by a newer knowledge update. The newer content is used instead.",
      };
    }

    // The new index is current and complete. Cleanup happens afterwards; if it
    // fails, the leftover rows are already ineligible and are reported by the
    // consistency diagnostics instead of being served to visitors.
    try {
      const keepIds = new Set(insertedIds);
      await deleteStaleChunks(sourceId, businessId, targetVersion, keepIds);
    } catch (cleanupError: any) {
      console.warn(
        `[Embeddings] Index ${runId} finalised but stale chunk cleanup failed for source ${sourceId}:`,
        cleanupError
      );
    }

    return {
      success: true,
      chunkCount: records.length,
      embeddingsGenerated: recordsNeedingEmbedding.length,
      embeddingsReused: records.length - recordsNeedingEmbedding.length,
    };
  } catch (error: any) {
    await deleteInsertedRows(supabase, insertedIds);

    const failureMessage = error?.message || String(error);
    const failedAt = new Date().toISOString();
    const failureMetadata = {
      ...(source.metadata || {}),
      embedding_status: "failed",
      embedding_error: failureMessage,
      embedding_failed_at: failedAt,
    };

    // A failed rebuild of unchanged content leaves the existing, still-current
    // index in place. A failed rebuild of changed content stays ineligible.
    await supabase
      .from("knowledge_sources")
      .update({
        metadata: failureMetadata,
        index_status: sourceWasCurrent ? "ready" : "failed",
        index_run_id: null,
        index_started_at: null,
        index_error: failureMessage,
      })
      .eq("id", sourceId)
      .eq("business_id", businessId)
      .eq("content_version", targetVersion)
      .eq("index_run_id", runId);

    console.error(`[Embeddings] Failed to index source ${sourceId}:`, error);
    return { error: failureMessage || "Failed to generate embeddings." };
  }
}
