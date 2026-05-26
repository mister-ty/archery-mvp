/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for single-instance MVP deployments. For multi-instance,
 * swap with Redis/Upstash via the same `checkRateLimit` interface.
 *
 * The previous Upstash-based implementation is intentionally removed:
 * it required `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
 * env vars that were never set in dev, so the limiter was inert.
 */

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number; // epoch ms
  retryAfterMs: number; // 0 when success
};

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

// Tunables — exported so tests can read them.
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Records an attempt for the given key (typically `<route>:<ip>`) and
 * returns whether the request should be allowed.
 *
 * Side-effect on each call:
 *  - Lazily evicts the bucket if its window has elapsed.
 *  - Increments count when within the window.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    const fresh: Entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    buckets.set(key, fresh);
    return {
      success: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetAt: fresh.resetAt,
      retryAfterMs: 0
    };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now
    };
  }

  entry.count += 1;
  return {
    success: true,
    remaining: RATE_LIMIT_MAX - entry.count,
    resetAt: entry.resetAt,
    retryAfterMs: 0
  };
}

/**
 * Test/admin helper — clear all buckets. Used by tests and could be
 * exposed via an admin endpoint later.
 */
export function resetRateLimit(): void {
  buckets.clear();
}
