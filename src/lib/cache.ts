import "server-only";
import { Redis } from "@upstash/redis";

// Same "optional until configured" contract as ratelimit.ts — reuses the same
// env vars, so no extra setup for anyone who's already got Upstash wired up.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null;

/**
 * Caches the result of `compute()` under `key` for `ttlSeconds`. Without
 * Redis configured, every call recomputes — same fallback as checkRateLimit.
 * Used for analytics, where a few minutes of staleness is a fine trade for
 * not re-running aggregation queries on every dashboard view.
 */
export async function cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  if (!redis) return compute();

  const hit = await redis.get<T>(key);
  if (hit !== null && hit !== undefined) return hit;

  const value = await compute();
  await redis.set(key, value, { ex: ttlSeconds });
  return value;
}
