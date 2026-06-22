import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/widget/chat/route";
import { rateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/utils/supabase/service";
import { runBusinessChat } from "@/lib/actions/chat";

vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: vi.fn(),
  rateLimitResponse: vi.fn().mockReturnValue(new Response("Rate limited", { status: 429 })),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/actions/chat", () => ({
  runBusinessChat: vi.fn(),
}));

vi.mock("@/lib/config/platform-config", () => ({
  getConfig: vi.fn().mockResolvedValue("true"),
}));

describe("Widget Chat API Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail validation if fields are missing or invalid", async () => {
    const req = {
      json: async () => ({
        message: "", // empty message
      }),
      headers: {
        get: () => null,
      },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid widget chat request.");
  });

  it("should block request if rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Date.now() + 1000,
      limit: 10,
    });

    const req = {
      json: async () => ({
        businessId: "de305d54-75b4-431b-adb2-eb6b9e546014",
        message: "hello chatbot",
      }),
      headers: {
        get: (name: string) => (name === "x-forwarded-for" ? "127.0.0.1" : null),
      },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("should allow request and invoke runBusinessChat if widget config is enabled and valid", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: true,
      remaining: 9,
      reset: Date.now() + 1000,
      limit: 10,
    });

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            is_enabled: true,
            allowed_domains: ["testsite.com"],
            hosted_chat_enabled: true,
          },
          error: null,
        }),
      })),
    };
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any);

    vi.mocked(runBusinessChat).mockResolvedValueOnce({
      success: true,
      conversationId: "conv-123",
      reply: "Hi there!",
      assistantMessage: {} as any,
      intent: "general" as any,
      latencyMs: 100,
    });

    const req = {
      json: async () => ({
        businessId: "de305d54-75b4-431b-adb2-eb6b9e546014",
        message: "hello chatbot",
      }),
      headers: {
        get: (name: string) => {
          if (name === "x-forwarded-for") return "127.0.0.1";
          if (name === "origin") return "https://testsite.com";
          return null;
        },
      },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("Hi there!");
    expect(data.conversationId).toBe("conv-123");
  });
});
