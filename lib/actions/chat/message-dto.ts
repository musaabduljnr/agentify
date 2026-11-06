export type PublicMessageRole = "user" | "assistant";
export type OwnerMessageRole = PublicMessageRole | "system";

export interface PublicMessageDTO {
  id: string;
  role: PublicMessageRole;
  content: string;
  created_at: string | null;
  metadata?: { is_manual: true };
}

export interface OwnerMessageDTO {
  id: string;
  role: OwnerMessageRole;
  content: string;
  created_at: string | null;
  metadata?: Record<string, unknown>;
}

export interface MessageRow {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  created_at?: unknown;
  metadata?: unknown;
}

const OWNER_METADATA_KEYS = [
  "is_manual",
  "intent",
  "quality_passed",
  "quality_reason",
  "fallback_used",
  "provider",
  "model",
  "latency_ms",
  "cached_answer",
  "retrieval",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function baseFields(row: MessageRow) {
  if (typeof row.id !== "string" || typeof row.content !== "string") return null;
  return {
    id: row.id,
    content: row.content,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export function toPublicMessageDTO(row: MessageRow): PublicMessageDTO | null {
  const base = baseFields(row);
  if (!base || (row.role !== "user" && row.role !== "assistant")) return null;

  const isManual = isRecord(row.metadata) && row.metadata.is_manual === true;

  return {
    ...base,
    role: row.role,
    ...(isManual ? { metadata: { is_manual: true as const } } : {}),
  };
}

export function toOwnerMessageDTO(row: MessageRow): OwnerMessageDTO | null {
  const base = baseFields(row);
  if (!base || (row.role !== "user" && row.role !== "assistant" && row.role !== "system")) return null;

  const metadata: Record<string, unknown> = {};
  if (isRecord(row.metadata)) {
    for (const key of OWNER_METADATA_KEYS) {
      if (key in row.metadata) metadata[key] = row.metadata[key];
    }
  }

  return {
    ...base,
    role: row.role,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}
