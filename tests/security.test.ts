import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "@/lib/security/rate-limit";

describe("Production Rate Limiting Fail-Safe", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should fail open in production if Upstash credentials are missing", async () => {
    (process.env as any).NODE_ENV = "production";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await rateLimit("test-user", "widget_chat");

    expect(result.success).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Upstash Redis credentials are missing in production")
    );
    consoleSpy.mockRestore();
  });

  it("should use in-memory rate limiting in development when Upstash is missing", async () => {
    (process.env as any).NODE_ENV = "development";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    // First request
    const result1 = await rateLimit("test-dev-user", "payment_checkout");
    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(4);

    // Consume all remaining
    await rateLimit("test-dev-user", "payment_checkout");
    await rateLimit("test-dev-user", "payment_checkout");
    await rateLimit("test-dev-user", "payment_checkout");
    await rateLimit("test-dev-user", "payment_checkout");

    // Next request should block
    const resultBlocked = await rateLimit("test-dev-user", "payment_checkout");
    expect(resultBlocked.success).toBe(false);
    expect(resultBlocked.remaining).toBe(0);
  });
});
