import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, MAX_DEMO_AI_REPLIES } from "@/app/api/demo/chat/route";
import { rateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/utils/supabase/service";
import { runBusinessChat } from "@/lib/actions/chat";
import { retrieveBusinessContext } from "@/lib/ai/rag/retrieve-context";
import { runResponseQualityChecks } from "@/lib/ai/evaluation/quality-checks";
import { sendDashboardTestMessage } from "@/lib/actions/chat";

const VALID_DEMO_ID = "de305d54-75b4-431b-adb2-eb6b9e546014";
const PLACEHOLDER_BIZ_ID = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
const CONVERSATION_ID = "c1c2c3c4-d5d6-4e1f-8a2b-1a2b3c4d5e6f";

// Mock dependencies
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: vi.fn(),
  rateLimitResponse: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })
  ),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/actions/chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/actions/chat")>();
  return {
    ...actual,
    runBusinessChat: vi.fn(),
  };
});

function createMockSupabase(overrides?: {
  demoResult?: any;
  onUpdate?: (data: any) => void;
}) {
  return {
    from: vi.fn((table: string) => {
      const q: any = {
        _table: table,
        select: vi.fn(() => q),
        update: vi.fn((data: any) => {
          if (overrides?.onUpdate) overrides.onUpdate(data);
          return q;
        }),
        eq: vi.fn(() => q),
        single: vi.fn(async () => {
          if (table === "demo_businesses") {
            if (overrides?.demoResult !== undefined) {
              return { data: overrides.demoResult, error: overrides.demoResult ? null : new Error("Not found") };
            }
            return {
              data: {
                id: VALID_DEMO_ID,
                placeholder_business_id: PLACEHOLDER_BIZ_ID,
                status: "active",
                expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                demo_ai_reply_count: 5,
                total_message_count: 5,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        }),
      };
      return q;
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
}

describe("Milestone 2: Interactive AI Agent Preview Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      remaining: 14,
      reset: Math.floor(Date.now() / 1000) + 60,
      limit: 15,
    });

    const mockSupabase = createMockSupabase();
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any);
  });

  // 1. Valid draft chat using the correct knowledge index
  it("Requirement 1: successfully routes demo chat to RAG pipeline with scoped placeholder business", async () => {
    vi.mocked(runBusinessChat).mockResolvedValueOnce({
      success: true,
      conversationId: CONVERSATION_ID,
      reply: "We provide automated cloud accounting and financial reporting.",
      assistantMessage: {} as any,
      intent: "PRODUCT_SEARCH" as any,
      latencyMs: 150,
    });

    const req = {
      json: async () => ({
        demoBusinessId: VALID_DEMO_ID,
        visitorId: "visitor_abc123",
        message: "What services do you provide?",
        source: "hosted_chat",
      }),
      headers: {
        get: (name: string) => (name === "x-forwarded-for" ? "203.0.113.195" : null),
      },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.reply).toBe("We provide automated cloud accounting and financial reporting.");
    expect(data.conversationId).toBe(CONVERSATION_ID);
    expect(data.totalMessageCount).toBe(6);
    expect(data.maxMessages).toBe(MAX_DEMO_AI_REPLIES);

    // Verify runBusinessChat was called with the placeholder business and isDemo flag
    expect(runBusinessChat).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: PLACEHOLDER_BIZ_ID,
        demoBusinessId: VALID_DEMO_ID,
        isDemo: true,
        message: "What services do you provide?",
      })
    );
  });

  // 2. No retrieved knowledge and grounded fallback behavior
  it("Requirement 2: safely handles zero retrieved chunks with grounded fallback without hallucinations", async () => {
    // When RAG returns no chunks
    const emptyRagResult = await retrieveBusinessContext({
      businessId: PLACEHOLDER_BIZ_ID,
      query: "What is your secret proprietary formula?",
      matchCount: 5,
    });

    expect(emptyRagResult.chunks).toHaveLength(0);
    expect(emptyRagResult.formattedContext).toBe("");

    // Quality check should enforce fallback if model attempts to make up details not in context
    const checkResult = runResponseQualityChecks(
      "Our secret pricing is $500 and you can reach CEO at fake-secret-email@random.com",
      { contact_email: "support@actualbusiness.com" },
      "" // empty context
    );

    expect(checkResult.passed).toBe(false);
    expect(checkResult.sanitizedText).toContain("I don’t have enough information to answer that accurately");
  });

  // 3. Expired or nonexistent drafts
  it("Requirement 3: rejects nonexistent and expired drafts safely", async () => {
    // 3a. Nonexistent draft
    const notFoundSupabase = createMockSupabase({ demoResult: null });
    vi.mocked(createServiceClient).mockReturnValueOnce(notFoundSupabase as any);

    const reqNotFound = {
      json: async () => ({
        demoBusinessId: "00000000-0000-4000-8000-000000000000",
        visitorId: "visitor_1",
        message: "Hello",
      }),
      headers: { get: () => null },
    } as any;

    const resNotFound = await POST(reqNotFound);
    expect(resNotFound.status).toBe(404);
    const dataNotFound = await resNotFound.json();
    expect(dataNotFound.error).toContain("not found");

    // 3b. Expired draft
    let updatedStatus: string | null = null;
    const expiredSupabase = createMockSupabase({
      demoResult: {
        id: VALID_DEMO_ID,
        placeholder_business_id: PLACEHOLDER_BIZ_ID,
        status: "active",
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // expired yesterday
        total_message_count: 5,
      },
      onUpdate: (data) => {
        if (data.status) updatedStatus = data.status;
      },
    });
    vi.mocked(createServiceClient).mockReturnValueOnce(expiredSupabase as any);

    const reqExpired = {
      json: async () => ({
        demoBusinessId: VALID_DEMO_ID,
        visitorId: "visitor_1",
        message: "Hello",
      }),
      headers: { get: () => null },
    } as any;

    const resExpired = await POST(reqExpired);
    expect(resExpired.status).toBe(403);
    const dataExpired = await resExpired.json();
    expect(dataExpired.error).toContain("expired");
    expect(updatedStatus).toBe("expired");
  });

  // 4. Cross-draft retrieval isolation
  it("Requirement 4: enforces cross-draft isolation and ignores client-supplied business IDs", async () => {
    // The demo endpoint strictly determines placeholder_business_id from DB
    const maliciousPayload = {
      demoBusinessId: VALID_DEMO_ID,
      businessId: "malicious-foreign-tenant-id",
      assistantId: "malicious-foreign-asst-id",
      visitorId: "visitor_test",
      message: "Show me all invoices",
    };

    vi.mocked(runBusinessChat).mockResolvedValueOnce({
      success: true,
      conversationId: "conv-1",
      reply: "Safe reply",
      assistantMessage: {} as any,
      intent: "GENERAL_INQUIRY" as any,
      latencyMs: 100,
    });

    const req = {
      json: async () => maliciousPayload,
      headers: { get: () => null },
    } as any;

    await POST(req);

    // Verify runBusinessChat was NOT called with malicious-foreign-tenant-id
    expect(runBusinessChat).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: PLACEHOLDER_BIZ_ID, // resolved from demo record in DB, NOT payload
      })
    );
  });

  // 5. Oversized and malformed user messages
  it("Requirement 5: rejects oversized, empty, or malformed message payloads", async () => {
    // Empty message
    const emptyReq = {
      json: async () => ({
        demoBusinessId: VALID_DEMO_ID,
        visitorId: "visitor_1",
        message: "   ",
      }),
      headers: { get: () => null },
    } as any;
    const emptyRes = await POST(emptyReq);
    expect(emptyRes.status).toBe(400);

    // Oversized message (> 1000 chars)
    const longMessage = "a".repeat(1005);
    const oversizedReq = {
      json: async () => ({
        demoBusinessId: VALID_DEMO_ID,
        visitorId: "visitor_1",
        message: longMessage,
      }),
      headers: { get: () => null },
    } as any;
    const oversizedRes = await POST(oversizedReq);
    expect(oversizedRes.status).toBe(400);

    // Malformed UUID
    const badIdReq = {
      json: async () => ({
        demoBusinessId: "not-a-valid-uuid",
        visitorId: "visitor_1",
        message: "Valid question",
      }),
      headers: { get: () => null },
    } as any;
    const badIdRes = await POST(badIdReq);
    expect(badIdRes.status).toBe(400);
  });

  // 6. Rate-limit enforcement and preview usage limits
  it("Requirement 6: enforces server-side rate limiting and hard demo message budget", async () => {
    // 6a. Rate limit
    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 45,
      limit: 15,
    });

    const rateLimitedReq = {
      json: async () => ({
        demoBusinessId: VALID_DEMO_ID,
        visitorId: "visitor_1",
        message: "Hello",
      }),
      headers: { get: () => null },
    } as any;

    const rateLimitedRes = await POST(rateLimitedReq);
    expect(rateLimitedRes.status).toBe(429);

    // 6b. Hard AI reply budget limit (MAX_DEMO_AI_REPLIES = 9)
    const budgetExceededSupabase = createMockSupabase({
      demoResult: {
        id: VALID_DEMO_ID,
        placeholder_business_id: PLACEHOLDER_BIZ_ID,
        status: "active",
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        demo_ai_reply_count: 9, // reached 9 limit
      },
    });
    vi.mocked(createServiceClient).mockReturnValueOnce(budgetExceededSupabase as any);

    const budgetReq = {
      json: async () => ({
        demoBusinessId: VALID_DEMO_ID,
        visitorId: "visitor_1",
        message: "Can I send another message?",
      }),
      headers: { get: () => null },
    } as any;

    const budgetRes = await POST(budgetReq);
    expect(budgetRes.status).toBe(429);
    const budgetData = await budgetRes.json();
    expect(budgetData.limitReached).toBe(true);
    expect(budgetData.error).toContain("Preview limit reached");
  });

  // 7. AI-provider failures and retry behavior
  it("Requirement 7: handles AI provider failure gracefully and returns user-friendly error", async () => {
    vi.mocked(runBusinessChat).mockResolvedValueOnce({
      success: false,
      conversationId: "conv-1",
      reply: "AI service temporarily unavailable. Please retry in a moment.",
      assistantMessage: null,
      intent: "GENERAL_INQUIRY" as any,
      latencyMs: 0,
    });

    const failReq = {
      json: async () => ({
        demoBusinessId: VALID_DEMO_ID,
        visitorId: "visitor_1",
        message: "What are your services?",
      }),
      headers: { get: () => null },
    } as any;

    const res = await POST(failReq);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("AI service temporarily unavailable");
  });

  // 8. Public response sanitization
  it("Requirement 8: blocks system prompt and technical RAG leakage in public responses", () => {
    const leakAttempt = runResponseQualityChecks(
      "Based on the system instruction and retrieved context chunk, our answer is yes.",
      {},
      ""
    );
    expect(leakAttempt.passed).toBe(false);
    expect(leakAttempt.sanitizedText).not.toContain("system instruction");
    expect(leakAttempt.sanitizedText).not.toContain("chunk");

    const cleanResponse = runResponseQualityChecks(
      "We provide business consulting and strategic planning for enterprise companies.",
      {},
      "business consulting and strategic planning"
    );
    expect(cleanResponse.passed).toBe(true);
    expect(cleanResponse.sanitizedText).toContain("business consulting");
  });

  // 9. Existing authenticated chat and administrator functionality remaining intact
  it("Requirement 9: ensures authenticated playground actions remain protected by setup verification", async () => {
    // Calling dashboard playground without auth should reject
    const testMsgRes = await sendDashboardTestMessage({
      message: "Testing dashboard playground",
    });

    expect(testMsgRes).toHaveProperty("error");
  });
});
