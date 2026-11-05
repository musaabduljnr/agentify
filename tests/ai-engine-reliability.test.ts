import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/engine/chat", () => ({
  generateChatResponse: vi.fn(),
}));

vi.mock("@/lib/ai/engine/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/engine/embeddings")>();
  return {
    ...actual,
    generateEmbedding: vi.fn(),
    generateEmbeddingsBatch: vi.fn(),
  };
});

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { generateChatResponse } from "@/lib/ai/engine/chat";
import { generateEmbedding } from "@/lib/ai/engine/embeddings";
import { createServiceClient } from "@/utils/supabase/service";
import { buildRetrievalQuery, retrieveBusinessContext } from "@/lib/ai/rag/retrieve-context";
import { formatContext, NO_KNOWLEDGE_CONTEXT } from "@/lib/ai/rag/build-context";
import { buildBusinessSystemPrompt } from "@/lib/ai/prompts/business-system-prompt";
import { runResponseQualityChecks } from "@/lib/ai/evaluation/quality-checks";
import { getAiResponse } from "@/lib/actions/chat/ai-response";
import { chunkText, chunkSourceText, hashContent } from "@/lib/embeddings/chunker";
import { buildReuseMap } from "@/lib/embeddings/generate-source";
import { assertCorrectDimensions } from "@/lib/ai/engine/embeddings";
import { executeWithRetryAndTimeout } from "@/lib/ai/engine/fallback";
import { canonicalizeCrawlUrl } from "@/lib/scraper/url-safety";
import { sanitizeAiExtraction, isUsableAiExtraction } from "@/lib/scraper/scrape-url";
import * as aiResponseModule from "@/lib/actions/chat/ai-response";

const mockGenerateChat = vi.mocked(generateChatResponse);

const business = {
  name: "Acme Studio",
  contact_email: "hello@acme.test",
  phone: "+2348000000000",
  whatsapp: null,
  address: "12 Main Street",
  website_url: "https://acme.test",
};

const assistant = {
  name: "Ada",
  tone: "friendly",
  welcome_message: "Hi there!",
};

beforeEach(() => {
  mockGenerateChat.mockReset();
});

describe("A. Follow-up retrieval query expansion", () => {
  it("inherits the previous user turn for referential follow-ups", () => {
    const query = buildRetrievalQuery("how much is it?", [
      { role: "user", content: "Do you offer website design?" },
      { role: "model", content: "Yes, we do." },
    ]);
    expect(query).toContain("Do you offer website design?");
    expect(query).toContain("Follow-up: how much is it?");
  });

  it("resumes the previous question for 'continue'", () => {
    expect(
      buildRetrievalQuery("continue", [
        { role: "user", content: "Explain your onboarding process step by step." },
      ])
    ).toBe("Explain your onboarding process step by step.");
  });

  it("leaves standalone long questions unchanged", () => {
    const standalone = "What are the refund conditions for annual billing plans please?";
    expect(buildRetrievalQuery(standalone, [
      { role: "user", content: "Do you offer website design?" },
    ])).toBe(standalone);
  });
});

describe("B. Chunking integrity", () => {
  it("never emits a chunk larger than the configured limit", () => {
    const longText = `${"A".repeat(1100)} ${"B".repeat(300)}`;
    const chunks = chunkText(longText, { maxChunkSize: 1200, overlap: 150 });
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1200);
    }
  });

  it("keeps page URL, page title, and section heading metadata", () => {
    const records = chunkSourceText(
      "=== Page: Pricing ===\nURL: https://acme.test/pricing\n# Plans\n\nOur basic plan costs 5000 naira per month and includes email support."
    );
    expect(records).toHaveLength(1);
    expect(records[0].pageUrl).toBe("https://acme.test/pricing");
    expect(records[0].pageTitle).toBe("Pricing");
    expect(records[0].sectionHeading).toBe("Plans");
    expect(records[0].contentHash).toHaveLength(64);
  });
});

describe("C. Crawl URL canonicalization", () => {
  it("strips tracking parameters, fragments, and parameter order noise", () => {
    expect(
      canonicalizeCrawlUrl(new URL("https://WWW.Acme.test/pricing/?utm_source=x&b=2&a=1#top"))
    ).toBe("https://www.acme.test/pricing?a=1&b=2");
  });
});

describe("D. AI extraction intake validation", () => {
  it("strips code fences and HTML from AI output", () => {
    const cleaned = sanitizeAiExtraction("```markdown\n<h1>Pricing</h1><p>Basic plan: 5000</p>\n```");
    expect(cleaned).not.toContain("```");
    expect(cleaned).not.toContain("<h1>");
    expect(cleaned).toContain("Pricing");
    expect(cleaned).toContain("Basic plan: 5000");
  });

  it("rejects refusals, scripts, and empty scraps", () => {
    expect(isUsableAiExtraction("I'm sorry, I cannot access the page content.", 0)).toBe(false);
    expect(isUsableAiExtraction("function () { window.location = 'x'; }", 0)).toBe(false);
    expect(isUsableAiExtraction("", 0)).toBe(false);
  });

  it("rejects an AI extraction that drops most deterministic content", () => {
    const tinySummary =
      "Acme sells products and services to local customers every day of the week and also provides support for every order placed online through the website store.";
    expect(isUsableAiExtraction(tinySummary, 800)).toBe(false);
    expect(isUsableAiExtraction(tinySummary, 0)).toBe(true);
  });

  it("accepts substantive extraction", () => {
    const substantive = Array.from({ length: 40 }, () => "reliable").join(" ") + " content.";
    expect(isUsableAiExtraction(substantive, 100)).toBe(true);
  });
});

describe("E. Embedding dimension enforcement", () => {
  it("rejects wrong dimensions instead of padding or truncating", () => {
    expect(() => assertCorrectDimensions([0.1, 0.2, 0.3], "gemini", "gemini-embedding-001"))
      .toThrow(/dimension mismatch/i);
  });

  it("rejects empty and non-finite vectors", () => {
    expect(() => assertCorrectDimensions([], "gemini", "gemini-embedding-001"))
      .toThrow(/empty vector/i);
    const invalid = Array.from({ length: 768 }, () => Number.NaN);
    expect(() => assertCorrectDimensions(invalid, "gemini", "gemini-embedding-001"))
      .toThrow(/non-numeric/i);
  });

  it("accepts 768 finite values", () => {
    const vector = Array.from({ length: 768 }, (_, i) => i / 768);
    expect(assertCorrectDimensions(vector, "gemini", "gemini-embedding-001")).toHaveLength(768);
  });
});

describe("F. Re-index vector reuse", () => {
  it("reuses only vectors with matching hashes and 768 valid dimensions", () => {
    const vector = Array.from({ length: 768 }, (_, i) => i / 768);
    const map = buildReuseMap([
      { id: "1", content: "Return policy is 30 days.", embedding: JSON.stringify(vector), metadata: { content_hash: "hash-a" } },
      { id: "2", content: "Broken vector.", embedding: [0.1, 0.2, 0.3], metadata: { content_hash: "hash-b" } },
      { id: "3", content: "Legacy chunk without hash.", embedding: vector, metadata: null },
    ]);

    expect(map.get("hash-a")).toHaveLength(768);
    expect(map.has("hash-b")).toBe(false);
    expect(map.get(hashContent("Legacy chunk without hash."))).toHaveLength(768);
  });

  it("matches new chunks to reusable hashes without deleting first", () => {
    const original = "=== Page: Pricing ===\nURL: https://acme.test/pricing\n# Plans\n\nOur basic plan costs 5000 naira per month.";
    const chunks = chunkSourceText(original);
    const vector = Array.from({ length: 768 }, () => 0.5);
    const map = buildReuseMap(
      chunks.map((chunk, index) => ({
        id: String(index),
        content: chunk.content,
        embedding: vector,
        metadata: { content_hash: chunk.contentHash },
      }))
    );

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(map.has(chunk.contentHash)).toBe(true);
    }
  });
});

describe("G. FAQ cache removal", () => {
  it("no longer exports the cross-conversation cache", () => {
    expect("checkResponseCache" in aiResponseModule).toBe(false);
  });

  it("calls the model on every repeated question instead of serving a cached answer", async () => {
    mockGenerateChat.mockResolvedValue({
      text: "We are open Monday to Friday, 9am to 5pm.",
      provider: "gemini",
      model: "gemini-2.5-flash",
      latencyMs: 10,
      fallbackUsed: false,
      promptTokensEstimate: 10,
      responseTokensEstimate: 10,
    } as any);

    const params = {
      message: "What are your opening hours?",
      businessId: "biz-1",
      conversationId: "conv-1",
      isDemo: false,
      business,
      assistant,
      formattedContext: "Verified excerpts from the business knowledge base:\n\n[Knowledge 1] Source: Hours\nMonday to Friday, 9am to 5pm.",
      metadata: {},
      summary: null,
      history: [],
      computedFeatureSource: "hosted_chat",
    };

    const first = await getAiResponse(params);
    const second = await getAiResponse(params);

    expect(mockGenerateChat).toHaveBeenCalledTimes(2);
    expect(first.cachedAnswer).toBe(false);
    expect(second.cachedAnswer).toBe(false);
    expect(first.finalReply).toContain("Monday to Friday");
  });
});

describe("H. Grounding prompt", () => {
  it("treats retrieved context as authoritative and forbids invented prices", () => {
    const prompt = buildBusinessSystemPrompt({
      business,
      assistant,
      contextText: "Verified excerpts from the business knowledge base:\n\nBasic plan costs 5000 naira.",
    });
    expect(prompt).toContain("# GROUNDING RULES (HIGHEST PRIORITY)");
    expect(prompt).toContain("Context is authoritative");
    expect(prompt).toContain("No invented prices");
    expect(prompt).toContain("A summary is not verified current data");
  });

  it("instructs the assistant to use the fallback when no knowledge was retrieved", () => {
    const prompt = buildBusinessSystemPrompt({
      business,
      assistant,
      contextText: "No specific knowledge found for this query.",
    });
    expect(prompt).toContain("No verified knowledge excerpts were found");
    expect(prompt).toContain("I don't have that information on hand");
  });
});

describe("I. Response quality checks", () => {
  it("allows prices that are copied from the knowledge base", () => {
    const result = runResponseQualityChecks(
      "The basic plan costs ₦5,000 per month.",
      business,
      "Basic plan costs ₦5,000 per month."
    );
    expect(result.passed).toBe(true);
  });

  it("rejects invented prices", () => {
    const result = runResponseQualityChecks(
      "The basic plan costs ₦9,999 per month.",
      business,
      "Basic plan costs ₦5,000 per month."
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("unverified_price");
  });

  it("rejects contact details that are not in the profile or context", () => {
    const result = runResponseQualityChecks(
      "Email us at fake@elsewhere.test.",
      business,
      "We are open Monday to Friday."
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("hallucinated_email");
  });

  it("integration: unsafe model output is replaced and reported as failed", async () => {
    mockGenerateChat.mockResolvedValue({
      text: "Our platinum plan costs $1,234 per year.",
      provider: "gemini",
      model: "gemini-2.5-flash",
      latencyMs: 10,
      fallbackUsed: false,
      promptTokensEstimate: 10,
      responseTokensEstimate: 10,
    } as any);

    const result = await getAiResponse({
      message: "How much is the platinum plan?",
      businessId: "biz-1",
      conversationId: "conv-1",
      isDemo: false,
      business,
      assistant,
      formattedContext: "Verified excerpts from the business knowledge base:\n\nThe basic plan costs ₦5,000 per month.",
      metadata: {},
      summary: null,
      history: [],
      computedFeatureSource: "hosted_chat",
    });

    expect(result.quality.passed).toBe(false);
    expect(result.quality.reason).toBe("unverified_price");
    expect(result.finalReply).not.toContain("$1,234");
  });
});

describe("J. Retrieval context formatting", () => {
  it("includes the page URL and section heading for traceability", () => {
    const formatted = formatContext([
      {
        id: "chunk-1",
        source_id: "source-1",
        content: "Our basic plan costs 5000 naira per month.",
        similarity: 0.82,
        metadata: {
          source_title: "Pricing",
          source_type: "website",
          page_url: "https://acme.test/pricing",
          section_heading: "Plans",
        },
      },
    ]);

    expect(formatted).toContain("Verified excerpts from the business knowledge base:");
    expect(formatted).toContain("Page: https://acme.test/pricing");
    expect(formatted).toContain("Section: Plans");
  });
});

describe("K. Request timeout cancellation", () => {
  it("aborts the transport signal when the deadline fires", async () => {
    let receivedSignal: AbortSignal | undefined;

    await expect(
      executeWithRetryAndTimeout(
        "gemini",
        (signal) => {
          receivedSignal = signal;
          return new Promise(() => {});
        },
        { maxRetries: 0, timeoutMs: 25 }
      )
    ).rejects.toThrow("Request timed out after 25ms");

    expect(receivedSignal?.aborted).toBe(true);
  });
});

describe("L. Retrieval diagnostics", () => {
  it("reports candidate, threshold, and final counts", async () => {
    vi.mocked(generateEmbedding).mockResolvedValue(
      Array.from({ length: 768 }, () => 0.1)
    );

    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "c1",
          source_id: "s1",
          content: "Basic plan costs 5000 naira per month.",
          similarity: 0.8,
          metadata: { source_title: "Pricing", source_type: "website" },
        },
        {
          id: "c2",
          source_id: "s1",
          content: "The basic plan includes email support.",
          similarity: 0.6,
          metadata: { source_title: "Pricing", source_type: "website" },
        },
        {
          id: "c3",
          source_id: "s1",
          content: "Unrelated legal notice.",
          similarity: 0.2,
          metadata: { source_title: "Legal", source_type: "website" },
        },
      ],
      error: null,
    });

    vi.mocked(createServiceClient).mockReturnValue({ rpc } as any);

    const result = await retrieveBusinessContext({
      businessId: "biz-1",
      query: "How much is the basic plan?",
      matchCount: 5,
      minSimilarity: 0.55,
    });

    expect(result.chunks).toHaveLength(2);
    expect(result.diagnostics.candidates).toBe(3);
    expect(result.diagnostics.aboveThreshold).toBe(2);
    expect(result.diagnostics.finalCount).toBe(2);
    expect(result.diagnostics.topSimilarity).toBe(0.8);
    expect(result.diagnostics.retrievalError).toBeUndefined();
  });

  it("records retrieval failures instead of swallowing them", async () => {
    vi.mocked(generateEmbedding).mockResolvedValue(
      Array.from({ length: 768 }, () => 0.1)
    );
    vi.mocked(createServiceClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "rpc unavailable" } }),
    } as any);

    const result = await retrieveBusinessContext({
      businessId: "biz-1",
      query: "What are your hours?",
    });

    expect(result.chunks).toHaveLength(0);
    expect(result.formattedContext).toBe(NO_KNOWLEDGE_CONTEXT);
    expect(result.diagnostics.retrievalError).toBe("rpc unavailable");
  });
});
