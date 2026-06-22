import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendDashboardTestMessage } from "@/lib/actions/chat";
import { requireCompleteBusinessSetup } from "@/lib/queries/business";
import { rateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";

vi.mock("@/lib/queries/business", () => ({
  requireCompleteBusinessSetup: vi.fn(),
  getCurrentBusinessSetup: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: vi.fn(),
  RATE_LIMITS: { playground_chat: { requests: 30, window: 3600 } },
}));

// Mock all internal and external dependencies of runBusinessChat
vi.mock("@/utils/supabase/service", () => {
  const mockChain: any = {};
  mockChain.select = vi.fn().mockReturnValue(mockChain);
  mockChain.eq = vi.fn().mockReturnValue(mockChain);
  mockChain.single = vi.fn().mockImplementation((table) => {
    return Promise.resolve({ data: { id: "biz-123", name: "Mock Biz" }, error: null });
  });
  mockChain.maybeSingle = vi.fn().mockImplementation(() => {
    return Promise.resolve({ data: null, error: null });
  });
  mockChain.insert = vi.fn().mockReturnValue(mockChain);
  mockChain.update = vi.fn().mockReturnValue(mockChain);

  return {
    createServiceClient: vi.fn(() => ({
      from: vi.fn(() => mockChain),
    })),
  };
});

vi.mock("@/utils/supabase/server", () => {
  const mockChain: any = {};
  mockChain.select = vi.fn().mockReturnValue(mockChain);
  mockChain.eq = vi.fn().mockReturnValue(mockChain);
  mockChain.single = vi.fn().mockImplementation(() => {
    return Promise.resolve({ data: { id: "biz-123", name: "Mock Biz" }, error: null });
  });

  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => mockChain),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
    })),
  };
});

vi.mock("@/lib/billing/usage", () => ({
  verifyAIUsageLimits: vi.fn().mockResolvedValue({ allowed: true }),
  checkUsageLimit: vi.fn().mockResolvedValue({ allowed: true, used: 0, limit: 100, remaining: 100 }),
  incrementUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ai/rag/retrieve-context", () => ({
  retrieveBusinessContext: vi.fn().mockResolvedValue({ chunks: ["chunk-1"], formattedContext: "Context info", intent: "general" }),
}));

vi.mock("@/lib/ai/memory/conversation-summary", () => ({
  summarizeConversationIfNeeded: vi.fn().mockResolvedValue("Mocked summary"),
}));

vi.mock("@/lib/ai/memory/message-history", () => ({
  getRecentConversationMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/actions/chat/conversation-management", () => ({
  resolveOrCreateConversation: vi.fn().mockResolvedValue({
    conversationId: "conv-123",
    conversation: { is_manual_takeover: false, metadata: {} },
  }),
}));

vi.mock("@/lib/actions/chat/message-persistence", () => ({
  saveUserMessage: vi.fn().mockResolvedValue(undefined),
  saveAssistantMessage: vi.fn().mockResolvedValue({ id: "msg-123", content: "Playground response", retrieved_chunks: ["chunk-1"] }),
}));

vi.mock("@/lib/actions/chat/lead-handling", () => ({
  processLeadHandling: vi.fn().mockResolvedValue({ metadata: {}, hasBuyingIntent: false, intentType: "general", requestedAction: null, extractedInfo: {} }),
}));

vi.mock("@/lib/actions/chat/ai-response", () => ({
  getAiResponse: vi.fn().mockResolvedValue({ finalReply: "Playground response", chatResponse: { latencyMs: 120 }, cachedAnswer: false }),
}));

vi.mock("@/lib/actions/chat/usage-tracking", () => ({
  processUsageTracking: vi.fn().mockResolvedValue(undefined),
}));

describe("sendDashboardTestMessage Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail if requireCompleteBusinessSetup throws an error", async () => {
    vi.mocked(requireCompleteBusinessSetup).mockRejectedValueOnce(new Error("Setup incomplete"));

    const result = await sendDashboardTestMessage({ message: "Hello chatbot" });
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Setup incomplete");
  });

  it("should fail if playground rate limit is exceeded", async () => {
    vi.mocked(requireCompleteBusinessSetup).mockResolvedValueOnce({
      user: { id: "user-123" },
      business: { id: "biz-123" },
      assistant: { id: "asst-123" },
      widgetConfig: { id: "widget-123" },
      subscription: { id: "sub-123" },
    } as any);

    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Date.now() + 1000,
      limit: 30,
    });

    const result = await sendDashboardTestMessage({ message: "Hello chatbot" });
    expect(result).toHaveProperty("error");
    expect(result.error).toContain("Too many AI playground messages");
  });

  it("should run business chat successfully if setup is complete and limit is not exceeded", async () => {
    vi.mocked(requireCompleteBusinessSetup).mockResolvedValueOnce({
      user: { id: "user-123" },
      business: { id: "biz-123" },
      assistant: { id: "asst-123" },
      widgetConfig: { id: "widget-123" },
      subscription: { id: "sub-123" },
    } as any);

    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: true,
      remaining: 29,
      reset: Date.now() + 1000,
      limit: 30,
    });

    const result: any = await sendDashboardTestMessage({ message: "Hello chatbot", conversationId: "conv-123" });
    expect(result.success).toBe(true);
    expect(result.reply).toBe("Playground response");
    expect(result.retrievedChunks).toEqual(["chunk-1"]);
  });
});
