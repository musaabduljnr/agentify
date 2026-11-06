export type KnowledgeIndexStatus = "pending" | "indexing" | "ready" | "failed";

export interface ChunkSourceLifecycleMetadata {
  source_version?: number | string | null;
  indexed_version?: number | string | null;
  content_version?: number | string | null;
  index_status?: string | null;
  source_status?: string | null;
  [key: string]: unknown;
}

/**
 * Defence in depth for chunks returned by match_knowledge_chunks. The database
 * function already filters to the current ready version, but a stale row must
 * never reach the prompt if the RPC result is mocked, cached, or partially
 * migrated.
 */
export function isChunkFromCurrentSource(
  metadata?: ChunkSourceLifecycleMetadata | null
): boolean {
  if (!metadata) return true;

  const { source_version, indexed_version, content_version, index_status } = metadata;

  // Rows created before lifecycle versioning have no lifecycle metadata. The
  // database function remains responsible for their eligibility.
  if (index_status == null || source_version == null || indexed_version == null) {
    return true;
  }

  if (index_status !== "ready") return false;
  if (content_version != null && Number(indexed_version) !== Number(content_version)) {
    return false;
  }

  return Number(source_version) === Number(indexed_version);
}

export function filterCurrentKnowledgeChunks<T extends { metadata?: ChunkSourceLifecycleMetadata | null }>(
  chunks: T[]
): T[] {
  return chunks.filter((chunk) => isChunkFromCurrentSource(chunk.metadata));
}

/**
 * A late indexing run may only finalise if the source still has the content
 * version it started from and the run id still belongs to it.
 */
export function isIndexRunCurrent(params: {
  sourceContentVersion: number | null | undefined;
  targetVersion: number;
  currentRunId: string | null | undefined;
  runId: string;
}): boolean {
  return (
    Number(params.sourceContentVersion) === Number(params.targetVersion) &&
    params.currentRunId === params.runId
  );
}

/**
 * Old chunks may be removed only for versions at or below the version being
 * indexed. A late job must never delete chunks belonging to newer content.
 */
export function canDeleteChunkForVersion(
  chunkVersion: number | string | null | undefined,
  targetVersion: number
): boolean {
  return Number(chunkVersion) <= Number(targetVersion);
}

/**
 * Re-indexing unchanged content can keep serving the previous index while the
 * new one is built, including when the rebuild fails.
 */
export function isReindexingCurrentContent(params: {
  indexStatus: string | null | undefined;
  indexedVersion: number | null | undefined;
  contentVersion: number | null | undefined;
}): boolean {
  return (
    params.indexStatus === "ready" &&
    params.indexedVersion != null &&
    Number(params.indexedVersion) === Number(params.contentVersion)
  );
}

export function readConversationKnowledgeVersion(
  metadata: Record<string, unknown> | null | undefined
): number | null {
  const raw = metadata?.knowledge_version;
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Older conversations have no stored version. They are stale only once the
 * business knowledge version has actually moved, which avoids discarding
 * history for every pre-migration conversation.
 */
export function isConversationKnowledgeStale(
  metadata: Record<string, unknown> | null | undefined,
  currentVersion: number
): boolean {
  const stored = readConversationKnowledgeVersion(metadata);
  if (stored == null) return Number(currentVersion) > 0;
  return stored !== Number(currentVersion);
}

/**
 * Visitor questions stay useful for follow-up query expansion. Earlier
 * assistant answers may repeat facts that have since changed, so they are not
 * sent back to the model after a knowledge change.
 */
export function retainUserTurnsOnly<T extends { role: string }>(history: T[]): T[] {
  return history.filter((message) => message.role === "user");
}

/**
 * Assistant answers are tagged with the knowledge version they were produced
 * from. A later turn may only reuse an answer whose version still matches.
 * Untagged answers are excluded once the business has versioned knowledge,
 * because they may predate a change. Visitor turns are always kept.
 */
export function isAssistantTurnCurrent(
  message: { role: string; metadata?: Record<string, unknown> | null },
  currentVersion: number
): boolean {
  if (message.role !== "assistant") return true;
  if (Number(currentVersion) === 0) return true;

  const stored = Number(message.metadata?.knowledge_version);
  return Number.isFinite(stored) && stored === Number(currentVersion);
}

export function withConversationKnowledgeVersion(
  metadata: Record<string, unknown> | null | undefined,
  knowledgeVersion: number
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    knowledge_version: Number(knowledgeVersion),
  };
}
