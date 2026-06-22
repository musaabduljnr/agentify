/**
 * Usage Cache — TTL-based in-memory cache for subscription usage reads.
 *
 * Reduces DB roundtrips during high-frequency chat requests.
 * Cache is invalidated immediately on usage writes.
 * TTL: 60 seconds per business.
 */

const CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
  data: UsageSnapshot;
  expiresAt: number;
}

interface UsageSnapshot {
  messages: { used: number; limit: number };
  embeddings: { used: number; limit: number };
  leads: { used: number; limit: number };
  knowledge_sources: { used: number; limit: number };
}

// Module-level cache — survives across requests in the same process
const usageCache = new Map<string, CacheEntry>();

/**
 * Get cached usage for a business, or null if expired/missing.
 */
export function getCachedUsage(businessId: string): UsageSnapshot | null {
  const entry = usageCache.get(businessId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    usageCache.delete(businessId);
    return null;
  }
  return entry.data;
}

/**
 * Store usage snapshot in cache.
 */
export function setCachedUsage(businessId: string, data: UsageSnapshot): void {
  usageCache.set(businessId, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Invalidate cache for a specific business.
 * Call this after any successful usage increment.
 */
export function invalidateUsageCache(businessId: string): void {
  usageCache.delete(businessId);
}

/**
 * Clear all cached entries (for testing/admin use).
 */
export function clearUsageCache(): void {
  usageCache.clear();
}

/**
 * Return cache stats (for monitoring/debugging).
 */
export function getUsageCacheStats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;
  usageCache.forEach(entry => {
    if (now > entry.expiresAt) expired++;
    else active++;
  });
  return { active, expired, total: usageCache.size };
}
