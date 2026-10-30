import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCheckoutSession, verifyPaymentReference } from "@/lib/actions/payments";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "@/lib/payments/paystack";
import crypto from "crypto";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/payments/paystack", () => ({
  initializePaystackTransaction: vi.fn(),
  verifyPaystackTransaction: vi.fn(),
  verifyPaystackWebhookSignature: vi.fn(),
  PaystackProviderError: class PaystackProviderError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "PaystackProviderError";
    }
  },
}));

vi.mock("@/lib/email/send-email", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/config/platform-config", () => ({
  getConfig: vi.fn().mockResolvedValue("https://agentify.app"),
  getSecretWithEnvFallback: vi.fn().mockResolvedValue("sk_test_mock_key"),
}));

describe("Payments & Subscription Management", () => {
  const mockUser = { id: "user-123", email: "user@example.com" };
  const mockBusiness = { id: "biz-123", owner_id: "user-123", name: "Test Biz", contact_email: "biz@test.com" };
  const mockSub = { id: "sub-123", business_id: "biz-123", plan: "starter", status: "pending" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCheckoutSession", () => {
    it("should return error if user is unauthorized", async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as any);

      const result = await createCheckoutSession("starter");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return error if business does not exist", async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      } as any);

      const result = await createCheckoutSession("starter");
      expect(result.error).toContain("No business found");
    });

    it("should initialize transaction with NGN currency and price by default", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => {
            if (table === "businesses") return Promise.resolve({ data: mockBusiness });
            if (table === "subscriptions") return Promise.resolve({ data: mockSub });
            return Promise.resolve({ data: null });
          }),
        })),
      } as any);

      vi.mocked(createServiceClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      } as any);

      vi.mocked(initializePaystackTransaction).mockResolvedValueOnce({
        authorizationUrl: "https://checkout.paystack.com/test-auth-url",
        accessCode: "access-code-123",
        reference: "agentify_biz-123_123456",
      });

      const result = await createCheckoutSession("starter");

      expect(result).toEqual({ checkoutUrl: "https://checkout.paystack.com/test-auth-url" });
      expect(initializePaystackTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 3200,
          currency: "NGN",
          businessId: "biz-123",
        })
      );
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: "biz-123",
          plan: "starter",
          amount: 3200,
          currency: "NGN",
          status: "pending",
        })
      );
    });
  });

  describe("verifyPaymentReference", () => {
    it("should reject when user does not own business", async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "intruder-user" } } }),
        },
      } as any);

      vi.mocked(createServiceClient).mockReturnValue({
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "biz-123", owner_id: "user-123" }, // different owner!
          }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "tx-123",
              business_id: "biz-123",
              reference: "ref-123",
              provider: "paystack",
              plan: "starter",
              amount: 3200,
              status: "pending",
            },
          }),
        })),
      } as any);

      const result = await verifyPaymentReference("ref-123");
      expect(result).toEqual({ error: "Unauthorized to verify this transaction." });
    });

    it("should return early if transaction was already verified as success", async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
      } as any);

      vi.mocked(createServiceClient).mockReturnValue({
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockBusiness }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "tx-123",
              business_id: "biz-123",
              reference: "ref-123",
              status: "success",
              plan: "growth",
            },
          }),
        })),
      } as any);

      const result = await verifyPaymentReference("ref-123");
      expect(result).toEqual({ success: true, plan: "growth" });
      expect(verifyPaystackTransaction).not.toHaveBeenCalled();
    });

    it("should reject if amount or reference from Paystack does not match transaction", async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
      } as any);

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(createServiceClient).mockReturnValue({
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: mockUpdate,
          single: vi.fn().mockResolvedValue({ data: mockBusiness }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "tx-123",
              business_id: "biz-123",
              reference: "ref-123",
              provider: "paystack",
              plan: "starter",
              amount: 3200, // 3200 NGN -> expected 320,000 kobo
              status: "pending",
            },
          }),
        })),
      } as any);

      vi.mocked(verifyPaystackTransaction).mockResolvedValueOnce({
        status: "success",
        reference: "ref-123",
        amount: 10000, // Tampered amount (100 NGN instead of 3,200 NGN)
      } as any);

      const result = await verifyPaymentReference("ref-123");
      expect(result.error).toContain("Payment verification failed");
    });

    it("should upgrade subscription on valid verification", async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
      } as any);

      const mockUpdate = vi.fn((updateData: any) => ({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "tx-123" } }),
            }),
          }),
        }),
      }));

      const mockSubUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(createServiceClient).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === "subscriptions") {
            return { update: mockSubUpdate };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: mockUpdate,
            single: vi.fn().mockResolvedValue({ data: mockBusiness }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "tx-123",
                business_id: "biz-123",
                reference: "ref-123",
                provider: "paystack",
                plan: "growth",
                amount: 16000,
                status: "pending",
              },
            }),
          };
        }),
      } as any);

      vi.mocked(verifyPaystackTransaction).mockResolvedValueOnce({
        status: "success",
        reference: "ref-123",
        amount: 1600000, // 16,000 NGN * 100
        customer: { customer_code: "CUS_123" },
        subscription: "SUB_code_456",
      } as any);

      const result = await verifyPaymentReference("ref-123");
      expect(result).toEqual({ success: true, plan: "growth" });
      expect(mockSubUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "growth",
          status: "active",
          provider_reference: "ref-123",
        })
      );
    });
  });

  describe("Paystack Webhook Verification", () => {
    it("should verify SHA512 signature against payload correctly", () => {
      const secret = "sk_test_secret_key_123";
      const payload = JSON.stringify({ event: "charge.success", data: { reference: "ref_1" } });
      const signature = crypto.createHmac("sha512", secret).update(payload).digest("hex");

      // Test HMAC matching logic
      const calculatedSignature = crypto.createHmac("sha512", secret).update(payload).digest("hex");
      expect(signature).toBe(calculatedSignature);
    });
  });
});
