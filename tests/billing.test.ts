import { describe, it, expect, vi, beforeEach } from "vitest";
import { incrementUsage, checkUsageLimit } from "@/lib/billing/usage";
import { createServiceClient } from "@/utils/supabase/service";

// Mock Supabase service client
vi.mock("@/utils/supabase/service", () => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockSelect = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: "sub-123", current_usage: 10, message_limit: 100 },
    error: null,
  });
  const mockRpc = vi.fn().mockResolvedValue({ error: null });

  const mockQueryBuilder = {
    insert: mockInsert,
    update: vi.fn().mockReturnThis(),
    select: mockSelect,
    eq: mockEq,
    maybeSingle: mockMaybeSingle,
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ data: [{ amount: 5 }], error: null }),
    then: vi.fn().mockImplementation(function (resolve) {
      if (resolve) resolve({ error: null });
      return Promise.resolve({ error: null });
    }),
  };

  const client = {
    from: vi.fn(() => mockQueryBuilder),
    rpc: mockRpc,
  };

  return {
    createServiceClient: () => client,
  };
});

describe("Billing Usage Tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should atomically call increment_subscription_usage RPC on message type", async () => {
    const serviceClient = createServiceClient();
    await incrementUsage("biz-123", "message", 1);

    // Verify RPC is called
    expect(serviceClient.rpc).toHaveBeenCalledWith("increment_subscription_usage", {
      p_business_id: "biz-123",
      p_amount: 1,
    });
  });

  it("should trigger fallback direct update if RPC fails", async () => {
    const serviceClient = createServiceClient();
    vi.mocked(serviceClient.rpc).mockResolvedValueOnce({
      error: {
        message: "RPC not found",
        details: "",
        hint: "",
        code: "P0001",
      } as any,
    } as any);

    // Mock direct update response
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockThen = vi.fn().mockImplementation(function (resolve) {
      if (resolve) resolve({ error: null });
      return Promise.resolve({ error: null });
    });

    vi.mocked(serviceClient.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: mockUpdate,
      select: vi.fn().mockReturnThis(),
      eq: mockEq,
      then: mockThen,
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "sub-123", current_usage: 15 },
        error: null,
      }),
    } as any);

    await incrementUsage("biz-123", "message", 2);

    expect(mockUpdate).toHaveBeenCalledWith({
      current_usage: 17, // 15 (current) + 2 (amount)
    });
  });

  it("should compute limits and remaining usage correctly", async () => {
    const serviceClient = createServiceClient();
    
    // Mock the responses for checking limits
    vi.mocked(serviceClient.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "sub-123",
          message_limit: 100,
          current_period_start: "2026-06-22T00:00:00Z",
        },
        error: null,
      }),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({
        data: [
          { amount: 10 },
          { amount: 20 },
        ],
        error: null,
      }),
    } as any);

    const result = await checkUsageLimit("biz-123", "message");
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(30);
    expect(result.limit).toBe(100);
    expect(result.remaining).toBe(70);
  });
});
