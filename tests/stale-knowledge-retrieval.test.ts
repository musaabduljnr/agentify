import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("@/lib/ai/engine/chat", () => ({
  generateChatResponse: vi.fn(),
}));

import { generateChatResponse } from "@/lib/ai/engine/chat";
import { classifyQueryIntent } from "@/lib/ai/intent/classify-query";
import { selectKnowledgeChunks } from "@/lib/ai/rag/select-chunks";
import { formatContext } from "@/lib/ai/rag/build-context";
import { type RetrievedChunk } from "@/lib/ai/rag/types";
import { type ChatResponse } from "@/lib/ai/engine/types";
import { getAiResponse } from "@/lib/actions/chat/ai-response";
import {
  canDeleteChunkForVersion,
  filterCurrentKnowledgeChunks,
  isChunkFromCurrentSource,
  isAssistantTurnCurrent,
  isConversationKnowledgeStale,
  isIndexRunCurrent,
  isReindexingCurrentContent,
  readConversationKnowledgeVersion,
  retainUserTurnsOnly,
  withConversationKnowledgeVersion,
} from "@/lib/knowledge/lifecycle";

const migrationPath = path.resolve(
  __dirname,
  "../supabase/migrations/20261106010000_knowledge_lifecycle_versioning.sql"
);

function chunk(params: {
  id: string;
  sourceId: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}): RetrievedChunk {
  return {
    id: params.id,
    source_id: params.sourceId,
    content: params.content,
    similarity: params.similarity,
    metadata: {
      source_title: "Basic Website Package",
      source_type: "manual",
      ...(params.metadata || {}),
    },
  };
}

const business = {
  name: "NovaTech Studio",
  contact_email: "hello@novatech.example",
  phone: null,
  whatsapp: null,
  address: null,
  website_url: "https://novatech.example",
};

const assistant = {
  name: "Nova",
  tone: "friendly",
  welcome_message: "Hi!",
};

beforeEach(() => {
  vi.mocked(generateChatResponse).mockReset();
});

describe("Stale knowledge reproduction: old source vs replacement source", () => {
  // Fixture mirrors the reported scenario. The old source was deleted and a
  // replacement source with the same title was indexed. The old chunks are
  // modelled as rows a leaky or pre-fix retrieval path could still return.
  const oldSourceChunk = chunk({
    id: "chunk-old-100k",
    sourceId: "source-old",
    content:
      "Basic Website Package costs ₦100,000 and delivery takes 7 days after payment.",
    similarity: 0.93,
    metadata: {
      source_title: "Basic Website Package",
      source_version: 1,
      indexed_version: 1,
      content_version: 1,
      index_status: "pending",
      source_status: "trained",
    },
  });

  const failedIndexChunk = chunk({
    id: "chunk-failed-200k",
    sourceId: "source-failed",
    content: "Basic Website Package costs ₦200,000 and delivery takes 10 days.",
    similarity: 0.91,
    metadata: {
      source_version: 2,
      indexed_version: 2,
      content_version: 2,
      index_status: "failed",
    },
  });

  const supersededVersionChunk = chunk({
    id: "chunk-superseded-v1",
    sourceId: "source-replacement",
    content: "Basic Website Package costs ₦100,000 and delivery takes 7 days.",
    similarity: 0.9,
    metadata: {
      source_version: 1,
      indexed_version: 2,
      content_version: 2,
      index_status: "ready",
    },
  });

  const currentReplacementChunk = chunk({
    id: "chunk-current-350k",
    sourceId: "source-replacement",
    content:
      "Basic Website Package costs ₦350,000. Delivery takes 21 working days after we receive the requirements and content. It includes a five-page website, mobile-responsive design, and two rounds of revisions.",
    similarity: 0.88,
    metadata: {
      source_version: 2,
      indexed_version: 2,
      content_version: 2,
      index_status: "ready",
      source_status: "trained",
    },
  });

  it("drops deleted, failed, and superseded chunks before prompt context is built", () => {
    const rawFromLeakyRetrieval = [
      oldSourceChunk,
      failedIndexChunk,
      supersededVersionChunk,
      currentReplacementChunk,
    ];

    const active = filterCurrentKnowledgeChunks(rawFromLeakyRetrieval);
    const selection = selectKnowledgeChunks(active, {
      minSimilarity: 0.55,
      intent: classifyQueryIntent("How much does the Basic Website Package cost?"),
      query: "How much does the Basic Website Package cost?",
    });
    const context = formatContext(selection.chunks);

    // This is the text handed to the model in the reproduction.
    console.log("[Stale knowledge reproduction] Context passed to model:\n" + context);

    expect(active.map((entry) => entry.id)).toEqual(["chunk-current-350k"]);
    expect(context).toContain("₦350,000");
    expect(context).toContain("21 working days");
    expect(context).not.toContain("₦100,000");
    expect(context).not.toContain("₦200,000");
    expect(context).not.toContain("7 days after payment");
  });

  it("answers cost and delivery from the replacement version, in a new conversation", () => {
    const active = filterCurrentKnowledgeChunks([
      oldSourceChunk,
      supersededVersionChunk,
      currentReplacementChunk,
    ]);

    const pricing = selectKnowledgeChunks(active, {
      minSimilarity: 0.55,
      intent: classifyQueryIntent("How much does the Basic Website Package cost?"),
      query: "How much does the Basic Website Package cost?",
    });
    const delivery = selectKnowledgeChunks(active, {
      minSimilarity: 0.55,
      intent: classifyQueryIntent("How long does delivery take?"),
      query: "How long does delivery take?",
    });

    expect(formatContext(pricing.chunks)).toContain("₦350,000");
    expect(formatContext(delivery.chunks)).toContain("21 working days");
  });
});

describe("Chunk lifecycle eligibility", () => {
  const base = {
    source_version: 2,
    indexed_version: 2,
    content_version: 2,
    index_status: "ready",
  };

  it("accepts only the current ready version", () => {
    expect(isChunkFromCurrentSource(base)).toBe(true);
    expect(isChunkFromCurrentSource({ ...base, index_status: "failed" })).toBe(false);
    expect(isChunkFromCurrentSource({ ...base, index_status: "indexing" })).toBe(false);
    expect(isChunkFromCurrentSource({ ...base, source_version: 1 })).toBe(false);
    expect(isChunkFromCurrentSource({ ...base, indexed_version: 1 })).toBe(false);
  });

  it("keeps legacy chunks without lifecycle metadata for the database filter", () => {
    expect(isChunkFromCurrentSource({ source_title: "Pricing" })).toBe(true);
    expect(isChunkFromCurrentSource(null)).toBe(true);
  });

  it("does not confuse one active source with another", () => {
    const activeA = chunk({
      id: "a",
      sourceId: "source-a",
      content: "Source A is active.",
      similarity: 0.8,
      metadata: { ...base },
    });
    const activeB = chunk({
      id: "b",
      sourceId: "source-b",
      content: "Source B is active.",
      similarity: 0.7,
      metadata: { ...base },
    });
    const deletedSource = chunk({
      id: "c",
      sourceId: "source-deleted",
      content: "Deleted source content.",
      similarity: 0.9,
      metadata: { ...base, index_status: "pending" },
    });

    expect(
      filterCurrentKnowledgeChunks([activeA, activeB, deletedSource]).map((entry) => entry.id)
    ).toEqual(["a", "b"]);
  });
});

describe("Indexing lifecycle and late-job protection", () => {
  it("only lets the run that owns the current content version finalise", () => {
    expect(
      isIndexRunCurrent({
        sourceContentVersion: 2,
        targetVersion: 2,
        currentRunId: "run-new",
        runId: "run-new",
      })
    ).toBe(true);

    expect(
      isIndexRunCurrent({
        sourceContentVersion: 3,
        targetVersion: 2,
        currentRunId: "run-new",
        runId: "run-old",
      })
    ).toBe(false);

    expect(
      isIndexRunCurrent({
        sourceContentVersion: 2,
        targetVersion: 2,
        currentRunId: "run-new",
        runId: "run-old",
      })
    ).toBe(false);
  });

  it("never deletes chunks from a newer content version", () => {
    expect(canDeleteChunkForVersion(1, 2)).toBe(true);
    expect(canDeleteChunkForVersion(2, 2)).toBe(true);
    expect(canDeleteChunkForVersion(3, 2)).toBe(false);
  });

  it("recognises a re-index of unchanged content so a failure keeps the old index", () => {
    expect(
      isReindexingCurrentContent({
        indexStatus: "ready",
        indexedVersion: 2,
        contentVersion: 2,
      })
    ).toBe(true);

    expect(
      isReindexingCurrentContent({
        indexStatus: "pending",
        indexedVersion: 1,
        contentVersion: 2,
      })
    ).toBe(false);
  });
});

describe("Conversation knowledge freshness", () => {
  it("treats pre-migration conversations as stale only after knowledge changes", () => {
    expect(isConversationKnowledgeStale({}, 0)).toBe(false);
    expect(isConversationKnowledgeStale(null, 0)).toBe(false);
    expect(isConversationKnowledgeStale({}, 1)).toBe(true);
  });

  it("compares the stored version with the current business version", () => {
    expect(isConversationKnowledgeStale({ knowledge_version: 3 }, 3)).toBe(false);
    expect(isConversationKnowledgeStale({ knowledge_version: 3 }, 4)).toBe(true);
    expect(readConversationKnowledgeVersion({ knowledge_version: "4" })).toBe(4);
    expect(readConversationKnowledgeVersion({})).toBeNull();
  });

  it("keeps assistant answers only while their knowledge version is current", () => {
    expect(
      isAssistantTurnCurrent({ role: "assistant", metadata: { knowledge_version: 3 } }, 3)
    ).toBe(true);
    expect(
      isAssistantTurnCurrent({ role: "assistant", metadata: { knowledge_version: 2 } }, 3)
    ).toBe(false);
    // Untagged answers may predate the lifecycle change, so they are excluded
    // once the business has versioned knowledge.
    expect(isAssistantTurnCurrent({ role: "assistant", metadata: {} }, 3)).toBe(false);
    expect(isAssistantTurnCurrent({ role: "assistant" }, 3)).toBe(false);
    expect(isAssistantTurnCurrent({ role: "user" }, 3)).toBe(true);
    expect(isAssistantTurnCurrent({ role: "assistant", metadata: {} }, 0)).toBe(true);
  });

  it("drops earlier assistant answers but keeps visitor questions after a change", () => {
    const history = [
      { role: "user", content: "How much is the Basic Website Package?" },
      { role: "model", content: "It costs ₦100,000 and takes 7 days." },
      { role: "user", content: "Does that include hosting?" },
    ];

    expect(retainUserTurnsOnly(history)).toEqual([
      { role: "user", content: "How much is the Basic Website Package?" },
      { role: "user", content: "Does that include hosting?" },
    ]);
  });

  it("preserves other conversation metadata when recording the version", () => {
    expect(
      withConversationKnowledgeVersion({ summary: "Visitor asked about pricing.", summary_msg_count: 10 }, 5)
    ).toEqual({
      summary: "Visitor asked about pricing.",
      summary_msg_count: 10,
      knowledge_version: 5,
    });
  });

  it("injects a knowledge-updated instruction when an existing conversation resumes", async () => {
    vi.mocked(generateChatResponse).mockResolvedValue({
      text: "Our Basic Website Package is ₦350,000 and delivery takes 21 working days.",
      provider: "gemini",
      model: "gemini-2.5-flash",
      latencyMs: 10,
      fallbackUsed: false,
      promptTokensEstimate: 10,
      responseTokensEstimate: 10,
    } as ChatResponse);

    const result = await getAiResponse({
      message: "How much does it cost now?",
      businessId: "biz-1",
      conversationId: "conv-1",
      isDemo: false,
      business,
      assistant,
      formattedContext: formatContext([
        chunk({
          id: "current",
          sourceId: "replacement",
          content:
            "Basic Website Package costs ₦350,000. Delivery takes 21 working days.",
          similarity: 0.9,
          metadata: {
            source_version: 2,
            indexed_version: 2,
            content_version: 2,
            index_status: "ready",
          },
        }),
      ]),
      metadata: {},
      summary: null,
      history: [{ role: "user", content: "How much is the Basic Website Package?" }],
      computedFeatureSource: "hosted_chat",
      knowledgeUpdated: true,
    });

    const prompt = vi.mocked(generateChatResponse).mock.calls[0][0].systemInstruction;
    expect(prompt).toContain("# KNOWLEDGE UPDATED DURING THIS CONVERSATION");
    expect(prompt).toContain("₦350,000");
    expect(prompt).toContain("21 working days");
    expect(prompt).not.toContain("₦100,000");
    expect(result.finalReply).toContain("₦350,000");
  });
});

describe("Knowledge migration and retrieval filters", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  it("adds source, chunk, and business version fields", () => {
    expect(sql).toContain("content_version integer NOT NULL DEFAULT 1");
    expect(sql).toContain("indexed_version integer");
    expect(sql).toContain("index_status text NOT NULL DEFAULT 'pending'");
    expect(sql).toContain("source_version integer NOT NULL DEFAULT 1");
    expect(sql).toContain("knowledge_version bigint NOT NULL DEFAULT 0");
  });

  it("bumps content version on replacement and guards late runs", () => {
    expect(sql).toContain("knowledge_sources_track_content_version");
    expect(sql).toContain("NEW.content_version := COALESCE(OLD.content_version, 1) + 1");
    expect(sql).toContain("NEW.index_status := 'pending'");
    expect(sql).toContain("NEW.index_run_id := NULL");
  });

  it("filters the vector RPC to the current ready version and the same business", () => {
    const rpc = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.match_knowledge_chunks"));
    expect(rpc).toContain("join public.knowledge_sources ks on ks.id = kc.source_id");
    expect(rpc).toContain("kc.business_id = match_business_id");
    expect(rpc).toContain("ks.business_id = match_business_id");
    expect(rpc).toContain("ks.index_status = 'ready'");
    expect(rpc).toContain("ks.indexed_version = ks.content_version");
    expect(rpc).toContain("kc.source_version = ks.indexed_version");
  });

  it("keeps failed backfill ineligible and seeds pre-migration business versions", () => {
    const failedCheck = sql.indexOf("WHEN ks.metadata->>'embedding_status' = 'failed' THEN 'failed'");
    const embeddedCheck = sql.indexOf("COALESCE(ks.metadata->>'embedded', 'false')");
    expect(failedCheck).toBeGreaterThan(-1);
    expect(failedCheck).toBeLessThan(embeddedCheck);

    expect(sql).toContain("UPDATE public.businesses b");
    expect(sql).toContain("COALESCE(b.knowledge_version, 0) + 1");
  });

  it("provides owner consistency diagnostics with stale and orphan counts", () => {
    expect(sql).toContain("get_knowledge_consistency");
    expect(sql).toContain("stale_chunk_count");
    expect(sql).toContain("count_orphaned_knowledge_chunks");
    expect(sql).toContain("SECURITY INVOKER");
  });
});
