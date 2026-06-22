/**
 * Rate Limiter
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 * Falls back to an in-memory sliding-window store for local development.
 *
 * Presets:
 * - widget_chat:           20 messages / visitor / 10 min
 * - embedding_generation:  10 requests / business / hour
 * - payment_checkout:       5 attempts / user    / hour
 * - admin_actions:        100 requests / hour
 * - widget_config:         60 requests / IP      / hour
 * - playground_chat:       30 messages / user    / hour
 */

export type RateLimitConfig = {
  requests: number; // max allowed in window
  window: number;   // window size in seconds
};

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;  // unix timestamp (seconds) when window resets
  limit: number;
};

// ── Presets ────────────────────────────────────────────────────────────────
export const RATE_LIMITS = {
  widget_chat:          { requests: 20,  window: 10 * 60 },  // 20 / 10 min
  embedding_generation: { requests: 10,  window: 60 * 60 },  // 10 / hr
  payment_checkout:     { requests: 5,   window: 60 * 60 },  // 5  / hr
  admin_actions:        { requests: 100, window: 60 * 60 },  // 100 / hr
  widget_config:        { requests: 60,  window: 60 * 60 },  // 60 / hr
  playground_chat:      { requests: 30,  window: 60 * 60 },  // 30 / hr
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMITS;

// ── In-Memory Store (dev / fallback) ──────────────────────────────────────
type MemoryEntry = { count: number; reset: number };
const memoryStore = new Map<string, MemoryEntry>();

// Prune stale entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Math.floor(Date.now() / 1000);
      for (const [key, entry] of memoryStore.entries()) {
        if (entry.reset < now) memoryStore.delete(key);
      }
    },
    5 * 60 * 1000
  );
}

function memoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  const entry = memoryStore.get(key);

  if (!entry || entry.reset < now) {
    // Start new window
    memoryStore.set(key, { count: 1, reset: now + config.window });
    return {
      success: true,
      remaining: config.requests - 1,
      reset: now + config.window,
      limit: config.requests,
    };
  }

  if (entry.count >= config.requests) {
    return {
      success: false,
      remaining: 0,
      reset: entry.reset,
      limit: config.requests,
    };
  }

  entry.count++;
  return {
    success: true,
    remaining: config.requests - entry.count,
    reset: entry.reset,
    limit: config.requests,
  };
}

// ── Upstash Redis (production) ─────────────────────────────────────────────
async function upstashRateLimit(
  key: string,
  config: RateLimitConfig,
  url: string,
  token: string
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  // Fixed window key — resets on every window boundary
  const windowBucket = Math.floor(now / config.window);
  const windowKey = `ratelimit:${key}:${windowBucket}`;

  try {
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", windowKey],
        ["EXPIRE", windowKey, config.window],
      ]),
    });

    if (!response.ok) {
      // Fail open: if Redis is unreachable, don't block the user
      console.error("[RateLimit] Upstash request failed:", response.status);
      return { success: true, remaining: 1, reset: now + config.window, limit: config.requests };
    }

    const results = await response.json();
    const count: number = results[0]?.result ?? 1;
    const reset = windowBucket * config.window + config.window;
    const remaining = Math.max(0, config.requests - count);

    return {
      success: count <= config.requests,
      remaining,
      reset,
      limit: config.requests,
    };
  } catch (err) {
    console.error("[RateLimit] Upstash error:", err);
    // Fail open
    return { success: true, remaining: 1, reset: now + config.window, limit: config.requests };
  }
}

// ── Main Export ────────────────────────────────────────────────────────────
/**
 * Check rate limit for a given identifier and preset.
 * @param identifier  Unique key (e.g. visitor ID, user ID, IP address)
 * @param preset      One of the RATE_LIMITS presets
 */
export async function rateLimit(
  identifier: string,
  preset: RateLimitPreset
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[preset];
  const key = `${preset}:${identifier}`;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (process.env.NODE_ENV === "production") {
    if (!upstashUrl || !upstashToken) {
      console.error("[RateLimit] CRITICAL: Upstash Redis credentials are missing in production!");
      // Fail safely (open): allow the request but do not fall back to in-memory store in production
      return {
        success: true,
        remaining: 1,
        reset: Math.floor(Date.now() / 1000) + config.window,
        limit: config.requests,
      };
    }
    return upstashRateLimit(key, config, upstashUrl, upstashToken);
  }

  if (upstashUrl && upstashToken) {
    return upstashRateLimit(key, config, upstashUrl, upstashToken);
  }

  return memoryRateLimit(key, config);
}

// ── Rate Limit HTTP Response Helper ───────────────────────────────────────
export function rateLimitResponse(result: RateLimitResult, corsHeaders?: Record<string, string>): Response {
  const retryAfter = Math.max(0, result.reset - Math.floor(Date.now() / 1000));
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please slow down and try again later.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.reset),
        "Retry-After": String(retryAfter),
        ...(corsHeaders ?? {}),
      },
    }
  );
}
