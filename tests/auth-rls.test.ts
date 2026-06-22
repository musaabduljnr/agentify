import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateSession } from "@/utils/supabase/middleware";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

describe("Middleware Authentication Redirection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect anonymous users trying to access dashboard to login", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    const mockSupabase = {
      auth: {
        getUser: mockGetUser,
      },
    };
    vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

    const request = new NextRequest("https://example.com/dashboard/settings", {
      headers: {
        host: "example.com",
      },
    });

    const res = await updateSession(request);
    expect(res.status).toBe(307); // NextResponse.redirect defaults to 307
    expect(res.headers.get("location")).toBe("https://example.com/login");
  });

  it("should redirect logged-in users trying to access login page to dashboard", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null });
    const mockSupabase = {
      auth: {
        getUser: mockGetUser,
      },
    };
    vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

    const request = new NextRequest("https://example.com/login", {
      headers: {
        host: "example.com",
      },
    });

    const res = await updateSession(request);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://example.com/dashboard");
  });

  it("should allow anonymous users to access public routes (like home page)", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    const mockSupabase = {
      auth: {
        getUser: mockGetUser,
      },
    };
    vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

    const request = new NextRequest("https://example.com/", {
      headers: {
        host: "example.com",
      },
    });

    const res = await updateSession(request);
    expect(res.status).toBe(200); // Allow request to pass through
  });
});
