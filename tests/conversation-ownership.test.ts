import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveOrCreateConversation } from "@/lib/actions/chat/conversation-management";

const state = vi.hoisted(() => ({
  conversationsById: new Map<string, any>(),
  insertPayloads: [] as any[],
  updates: [] as any[],
  rpcCalls: [] as any[],
  insertError: null as any,
  updateError: null as any,
  updateLosesRace: false,
  raceVisitorId: null as string | null,
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table === "conversations") {
        return {
          insert(payload: any) {
            state.insertPayloads.push(payload);
            const row = { id: "conv-new", ...payload };
            return {
              select: () => ({
                single: async () => ({
                  data: state.insertError ? null : row,
                  error: state.insertError,
                }),
              }),
              then: (resolve: (value: any) => void) => resolve({ data: null, error: null }),
            };
          },
          select() {
            const filters: Record<string, any> = {};
            const builder: any = {
              eq(column: string, value: any) {
                filters[column] = value;
                return builder;
              },
              maybeSingle: async () => {
                const row = filters.id ? state.conversationsById.get(filters.id) : undefined;
                const matchesBusiness =
                  !filters.business_id || (row && row.business_id === filters.business_id);
                return {
                  data: row && matchesBusiness ? { ...row } : null,
                  error: null,
                };
              },
            };
            return builder;
          },
          update(payload: any) {
            state.updates.push(payload);
            const filters: Record<string, any> = {};
            const builder: any = {
              eq(column: string, value: any) {
                filters[column] = value;
                return builder;
              },
              is: () => builder,
              select: () => ({
                maybeSingle: async () => {
                  if (state.updateError) return { data: null, error: state.updateError };

                  if (state.updateLosesRace) {
                    const row = state.conversationsById.get(filters.id);
                    if (row && state.raceVisitorId) row.visitor_id = state.raceVisitorId;
                    return { data: null, error: null };
                  }

                  const row = state.conversationsById.get(filters.id);
                  if (row) row.visitor_id = payload.visitor_id;
                  return { data: { visitor_id: payload.visitor_id }, error: null };
                },
              }),
            };
            return builder;
          },
        };
      }

      return {
        insert: async () => ({ error: null }),
      };
    },
    rpc: async (name: string, args: any) => {
      state.rpcCalls.push({ name, args });
      return { data: null, error: null };
    },
  }),
}));

const baseArgs = {
  businessId: "biz-a",
  message: "hello",
  source: "widget",
  isDemo: false,
};

beforeEach(() => {
  state.conversationsById.clear();
  state.insertPayloads = [];
  state.updates = [];
  state.rpcCalls = [];
  state.insertError = null;
  state.updateError = null;
  state.updateLosesRace = false;
  state.raceVisitorId = null;
});

describe("Widget conversation visitor ownership", () => {
  it("binds a new conversation to the visitor who created it", async () => {
    const result = await resolveOrCreateConversation({
      ...baseArgs,
      visitorId: "visitor-a",
    });

    expect(result.conversationId).toBe("conv-new");
    expect(state.insertPayloads[0]).toMatchObject({
      business_id: "biz-a",
      visitor_id: "visitor-a",
      source: "widget",
    });
  });

  it("allows the original visitor to continue the same conversation", async () => {
    state.conversationsById.set("conv-1", {
      id: "conv-1",
      business_id: "biz-a",
      visitor_id: "visitor-a",
    });

    const result = await resolveOrCreateConversation({
      ...baseArgs,
      currentConversationId: "conv-1",
      visitorId: "visitor-a",
    });

    expect(result.conversationId).toBe("conv-1");
    expect(state.updates).toHaveLength(0);
  });

  it("rejects another visitor trying to reuse the conversation id", async () => {
    state.conversationsById.set("conv-1", {
      id: "conv-1",
      business_id: "biz-a",
      visitor_id: "visitor-a",
    });

    await expect(
      resolveOrCreateConversation({
        ...baseArgs,
        currentConversationId: "conv-1",
        visitorId: "visitor-b",
      })
    ).rejects.toThrow("Conversation not found.");

    expect(state.updates).toHaveLength(0);
  });

  it("rejects a continuation without a visitor id when the conversation is already bound", async () => {
    state.conversationsById.set("conv-1", {
      id: "conv-1",
      business_id: "biz-a",
      visitor_id: "visitor-a",
    });

    await expect(
      resolveOrCreateConversation({
        ...baseArgs,
        currentConversationId: "conv-1",
      })
    ).rejects.toThrow("Conversation not found.");
  });

  it("rejects reuse of a conversation that belongs to another business", async () => {
    state.conversationsById.set("conv-1", {
      id: "conv-1",
      business_id: "biz-b",
      visitor_id: "visitor-a",
    });

    await expect(
      resolveOrCreateConversation({
        ...baseArgs,
        currentConversationId: "conv-1",
        visitorId: "visitor-a",
      })
    ).rejects.toThrow("Conversation not found.");
  });

  it("binds a legacy conversation with no visitor id on first continuation", async () => {
    state.conversationsById.set("conv-legacy", {
      id: "conv-legacy",
      business_id: "biz-a",
      visitor_id: null,
    });

    const result = await resolveOrCreateConversation({
      ...baseArgs,
      currentConversationId: "conv-legacy",
      visitorId: "visitor-a",
    });

    expect(result.conversationId).toBe("conv-legacy");
    expect(state.updates).toEqual([{ visitor_id: "visitor-a" }]);
    expect(result.conversation.visitor_id).toBe("visitor-a");
  });

  it("rejects an anonymous continuation of a legacy unbound conversation", async () => {
    state.conversationsById.set("conv-legacy", {
      id: "conv-legacy",
      business_id: "biz-a",
      visitor_id: null,
    });

    await expect(
      resolveOrCreateConversation({
        ...baseArgs,
        currentConversationId: "conv-legacy",
      })
    ).rejects.toThrow("Conversation not found.");
  });

  it("rejects a concurrent claim when another visitor won the binding race", async () => {
    state.conversationsById.set("conv-legacy", {
      id: "conv-legacy",
      business_id: "biz-a",
      visitor_id: null,
    });
    state.updateLosesRace = true;
    state.raceVisitorId = "visitor-b";

    await expect(
      resolveOrCreateConversation({
        ...baseArgs,
        currentConversationId: "conv-legacy",
        visitorId: "visitor-a",
      })
    ).rejects.toThrow("Conversation not found.");
  });

  it("surfaces a binding failure instead of silently continuing", async () => {
    state.conversationsById.set("conv-legacy", {
      id: "conv-legacy",
      business_id: "biz-a",
      visitor_id: null,
    });
    state.updateError = { message: "write failed" };

    await expect(
      resolveOrCreateConversation({
        ...baseArgs,
        currentConversationId: "conv-legacy",
        visitorId: "visitor-a",
      })
    ).rejects.toThrow("Failed to bind conversation to visitor: write failed");
  });
});

describe("Preserved conversation flows", () => {
  it("keeps dashboard-owner conversation management working", async () => {
    state.conversationsById.set("conv-dash", {
      id: "conv-dash",
      business_id: "biz-a",
      visitor_id: "visitor-a",
    });

    const result = await resolveOrCreateConversation({
      currentConversationId: "conv-dash",
      businessId: "biz-a",
      visitorId: undefined,
      source: "dashboard_test",
      isDemo: false,
      message: "test from dashboard",
    });

    expect(result.conversationId).toBe("conv-dash");
  });

  it("keeps demo conversation continuation working", async () => {
    state.conversationsById.set("conv-demo", {
      id: "conv-demo",
      business_id: "biz-a",
      visitor_id: "visitor-a",
    });

    const result = await resolveOrCreateConversation({
      currentConversationId: "conv-demo",
      businessId: "biz-a",
      visitorId: "visitor-b",
      source: "hosted_chat",
      isDemo: true,
      demoBusinessId: "demo-1",
      message: "hello demo",
    });

    expect(result.conversationId).toBe("conv-demo");
    expect(state.rpcCalls.map((call) => call.name)).toEqual([
      "increment_demo_conversation_msg_count",
      "increment_demo_message_count",
    ]);
  });

  it("keeps demo conversation creation working", async () => {
    const result = await resolveOrCreateConversation({
      businessId: "biz-a",
      visitorId: "visitor-a",
      source: "hosted_chat",
      isDemo: true,
      demoBusinessId: "demo-1",
      message: "start demo",
    });

    expect(result.conversationId).toBe("conv-new");
    expect(state.rpcCalls.map((call) => call.name)).toEqual([
      "increment_demo_conversation_count",
      "increment_demo_message_count",
    ]);
  });
});
