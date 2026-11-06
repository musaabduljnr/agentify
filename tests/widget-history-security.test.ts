import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/widget/chat/history/route";

const state = vi.hoisted(() => ({
  conversation: null as any,
  messages: [] as any[],
  user: null as any,
  profile: null as any,
  business: null as any,
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: () => ({
    from(table: string) {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(async () => ({ data: state.messages, error: null })),
        maybeSingle: vi.fn(async () => {
          if (table === "conversations") return { data: state.conversation, error: null };
          if (table === "profiles") return { data: state.profile, error: null };
          if (table === "businesses") return { data: state.business, error: null };
          return { data: null, error: null };
        }),
      };
      return builder;
    },
  }),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })),
    },
  }),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitResponse: vi.fn(() => new Response("Rate limited", { status: 429 })),
}));

const conversation = {
  visitor_id: "visitor-a",
  business_id: "biz-a",
  is_manual_takeover: false,
  metadata: {},
};

const messageRows = [
  { id: "m1", role: "user", content: "hello", created_at: "2026-01-01T00:00:00Z", metadata: null },
  {
    id: "m2",
    role: "assistant",
    content: "hi",
    created_at: "2026-01-01T00:00:01Z",
    metadata: {
      retrieval: { query: "internal-query", topSimilarity: 0.91 },
      provider: "gemini",
      model: "gemini-2.5-flash",
      quality_passed: true,
      system_prompt: "internal-prompt-text",
    },
  },
  {
    id: "m3",
    role: "assistant",
    content: "human agent reply",
    created_at: "2026-01-01T00:00:02Z",
    metadata: { is_manual: true },
  },
  { id: "m4", role: "system", content: "internal system note", created_at: "2026-01-01T00:00:03Z", metadata: {} },
  {
    id: "m5",
    role: "assistant",
    content: "chunk reply",
    created_at: "2026-01-01T00:00:04Z",
    metadata: {},
    retrieved_chunks: [{ content: "private-chunk-content", similarity: 0.88 }],
  },
];

function request(query: string) {
  return new NextRequest(`https://example.com/api/widget/chat/history?${query}`);
}

describe("Widget chat history public DTO", () => {
  beforeEach(() => {
    state.conversation = { ...conversation };
    state.messages = messageRows;
    state.user = null;
    state.profile = null;
    state.business = null;
  });

  it("returns normal visitor-visible message history", async () => {
    const res = await GET(request("conversationId=conv-a&visitorId=visitor-a"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.messages.map((message: any) => message.id)).toEqual(["m1", "m2", "m3", "m5"]);
    expect(body.messages[0]).toEqual({
      id: "m1",
      role: "user",
      content: "hello",
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(body.messages[2].metadata).toEqual({ is_manual: true });
  });

  it("does not expose retrieval diagnostics, prompts, provider data, or chunk contents", async () => {
    const res = await GET(request("conversationId=conv-a&visitorId=visitor-a"));
    const body = await res.json();
    const payload = JSON.stringify(body);

    expect(payload).not.toContain("internal-query");
    expect(payload).not.toContain("topSimilarity");
    expect(payload).not.toContain("internal-prompt-text");
    expect(payload).not.toContain("gemini");
    expect(payload).not.toContain("private-chunk-content");
    expect(payload).not.toContain("retrieved_chunks");
    expect(body.messages[1].metadata).toBeUndefined();
  });

  it("does not expose internal system messages to visitors", async () => {
    const res = await GET(request("conversationId=conv-a&visitorId=visitor-a"));
    const body = await res.json();

    expect(body.messages.some((message: any) => message.role === "system")).toBe(false);
    expect(body.messages.some((message: any) => message.content === "internal system note")).toBe(false);
  });

  it("rejects a visitor that does not own the conversation", async () => {
    const res = await GET(request("conversationId=conv-a&visitorId=visitor-b"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.messages).toBeUndefined();
  });
});

describe("Widget chat history owner access", () => {
  beforeEach(() => {
    state.conversation = { ...conversation };
    state.messages = messageRows;
    state.user = { id: "owner-1" };
    state.profile = { role: "client" };
    state.business = { id: "biz-a" };
  });

  it("keeps authorized retrieval diagnostics available to the business owner", async () => {
    const res = await GET(request("conversationId=conv-a"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.messages.some((message: any) => message.role === "system")).toBe(true);
    expect(body.messages[1].metadata).toMatchObject({
      retrieval: { query: "internal-query", topSimilarity: 0.91 },
      provider: "gemini",
      model: "gemini-2.5-flash",
      quality_passed: true,
    });
  });

  it("does not expose arbitrary unlisted metadata to the owner either", async () => {
    const res = await GET(request("conversationId=conv-a"));
    const body = await res.json();

    expect(body.messages[1].metadata.system_prompt).toBeUndefined();
    expect(body.messages[4].retrieved_chunks).toBeUndefined();
  });

  it("rejects an authenticated user who does not own the conversation's business", async () => {
    state.business = null;

    const res = await GET(request("conversationId=conv-a"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.messages).toBeUndefined();
  });
});
