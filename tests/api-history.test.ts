import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/widget/chat/history/route";
import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";

// Mock Supabase Clients
vi.mock("@/utils/supabase/service", () => {
  const mockMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      visitor_id: "visitor-uuid",
      business_id: "biz-uuid",
      is_manual_takeover: false,
      metadata: {},
    },
    error: null,
  });

  const mockSelect = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockResolvedValue({
    data: [{ id: "msg-1", role: "user", content: "hello" }],
    error: null,
  });

  const client = {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      maybeSingle: mockMaybeSingle,
    })),
  };

  return {
    createServiceClient: () => client,
  };
});

vi.mock("@/utils/supabase/server", () => {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  };
  return {
    createClient: () => client,
  };
});

vi.mock("@/lib/security/rate-limit", () => {
  return {
    rateLimit: vi.fn().mockResolvedValue({ success: true }),
    rateLimitResponse: vi.fn().mockReturnValue(new Response("Rate limited", { status: 429 })),
  };
});

describe("Widget Chat History API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if conversationId is missing", async () => {
    const req = new NextRequest("https://example.com/api/widget/chat/history");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing conversationId");
  });

  it("should return 429 if rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, remaining: 0, reset: 0, limit: 10 });

    const req = new NextRequest("https://example.com/api/widget/chat/history?conversationId=conv-123");
    const res = await GET(req);
    expect(res.status).toBe(429);
  });

  it("should return 403 if visitorId doesn't match and no owner is authenticated", async () => {
    const req = new NextRequest(
      "https://example.com/api/widget/chat/history?conversationId=conv-123&visitorId=wrong-visitor"
    );
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized access to conversation history");
  });

  it("should return 200 if visitorId matches the conversation's visitor_id", async () => {
    const req = new NextRequest(
      "https://example.com/api/widget/chat/history?conversationId=conv-123&visitorId=visitor-uuid"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe("hello");
  });

  it("should return 200 if authenticated user owns the business", async () => {
    const userClient = await createClient();
    vi.mocked(userClient.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: "user-owner-uuid" } } as any,
      error: null,
    });

    const serviceClient = createServiceClient();
    // Mock user is not admin, but owns the business
    vi.mocked(serviceClient.from).mockImplementation((table: string) => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      
      let resolveVal: any = { data: null };
      if (table === "conversations") {
        resolveVal = {
          data: { visitor_id: "visitor-uuid", business_id: "biz-uuid" },
          error: null,
        };
      } else if (table === "profiles") {
        resolveVal = { data: { role: "client" }, error: null };
      } else if (table === "businesses") {
        resolveVal = { data: { id: "biz-uuid" }, error: null };
      } else if (table === "messages") {
        resolveVal = { data: [{ id: "msg-1", role: "user", content: "hello" }], error: null };
      }

      return {
        select: mockSelect,
        eq: mockEq,
        maybeSingle: vi.fn().mockResolvedValue(resolveVal),
        order: vi.fn().mockResolvedValue(resolveVal),
      } as any;
    });

    const req = new NextRequest(
      "https://example.com/api/widget/chat/history?conversationId=conv-123"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(1);
  });
});
