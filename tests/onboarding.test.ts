import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeOnboarding, type OnboardingData } from "@/lib/actions/onboarding";
import { getCurrentBusinessSetup } from "@/lib/queries/business";
import { createClient } from "@/utils/supabase/server";

// Mock business queries and server actions
vi.mock("@/lib/queries/business", () => ({
  getCurrentBusinessSetup: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/email/send-email", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({ success: true }),
}));

describe("completeOnboarding Server Action", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };
  const validOnboardingData: OnboardingData = {
    businessName: "Test Business Ltd",
    industry: "SaaS Tech",
    websiteUrl: "https://testbiz.com",
    description: "An outstanding B2B SaaS software provider company.",
    contactEmail: "contact@testbiz.com",
    assistantName: "Botty",
    assistantTone: "Friendly",
    welcomeMessage: "Welcome to our support channel!",
    primaryColor: "#4f46e5",
    position: "bottom-right",
    suggestedQuestions: ["How does it work?"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail with error if user is unauthorized (not logged in)", async () => {
    vi.mocked(getCurrentBusinessSetup).mockResolvedValueOnce({
      user: null,
      profile: null,
      business: null,
      assistant: null,
      widgetConfig: null,
      subscription: null,
      isComplete: false,
    });

    await expect(completeOnboarding(validOnboardingData)).rejects.toThrow("Unauthorized");
  });

  it("should fail validation if contactEmail is invalid", async () => {
    vi.mocked(getCurrentBusinessSetup).mockResolvedValueOnce({
      user: mockUser as any,
      profile: null,
      business: null,
      assistant: null,
      widgetConfig: null,
      subscription: null,
      isComplete: false,
    });

    const invalidData = { ...validOnboardingData, contactEmail: "invalid-email" };
    const res = await completeOnboarding(invalidData);
    expect(res).toHaveProperty("error");
    expect(res.error).toBe("Invalid contact email");
  });

  it("should succeed and insert new business, assistant, widget, and subscription if they don't exist", async () => {
    const mockChain: any = {};
    mockChain.select = vi.fn().mockReturnValue(mockChain);
    mockChain.eq = vi.fn().mockReturnValue(mockChain);
    mockChain.insert = vi.fn().mockReturnValue(mockChain);
    mockChain.update = vi.fn().mockReturnValue(mockChain);
    mockChain.single = vi.fn().mockImplementation(() => {
      return Promise.resolve({ data: { id: "new-biz-id" }, error: null });
    });
    mockChain.maybeSingle = vi.fn().mockImplementation(() => {
      return Promise.resolve({ data: null, error: null });
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue(mockChain),
    };

    vi.mocked(getCurrentBusinessSetup).mockResolvedValueOnce({
      user: mockUser as any,
      profile: null,
      business: null,
      assistant: null,
      widgetConfig: null,
      subscription: null,
      isComplete: false,
    });

    vi.mocked(createClient).mockResolvedValueOnce(mockSupabase as any);

    const res = await completeOnboarding(validOnboardingData);
    expect(res).toEqual({ success: true });
    expect(mockSupabase.from).toHaveBeenCalledWith("businesses");
    expect(mockSupabase.from).toHaveBeenCalledWith("assistants");
    expect(mockSupabase.from).toHaveBeenCalledWith("widget_configs");
    expect(mockSupabase.from).toHaveBeenCalledWith("subscriptions");
  });
});
