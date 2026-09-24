import "server-only";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// FREE_TIER_LIMITS: Upstash's free tier (10k commands/day) is plenty for a
// project this size. Not required — see README's env var table. When unset,
// checkRateLimit() no-ops, same "optional until configured" contract as
// Cloudinary/Google/Telegram.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null;

type Window = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, limit: number, window: Window): Ratelimit | null {
  if (!redis) return null;
  const cacheKey = `${name}:${limit}:${window}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `ownreach:ratelimit:${name}`,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

export class RateLimitError extends Error {
  constructor(message = "You're doing that too often — try again in a bit.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Throws RateLimitError once `identifier` exceeds `limit` requests per
 * `window` for the given `name` bucket. No-ops (never throws) when
 * UPSTASH_REDIS_REST_URL/TOKEN aren't configured.
 */
export async function checkRateLimit(
  name: string,
  identifier: string,
  { limit, window }: { limit: number; window: Window }
): Promise<void> {
  const limiter = getLimiter(name, limit, window);
  if (!limiter) return;
  const { success } = await limiter.limit(identifier);
  if (!success) throw new RateLimitError();
}

/**
 * Route-handler variant: same as checkRateLimit but returns a 429
 * NextResponse instead of throwing, matching assertSameOrigin's
 * `NextResponse | null` convention for API routes (as opposed to Server
 * Actions, which just let RateLimitError propagate to the client's catch).
 */
export async function checkRateLimitResponse(
  name: string,
  identifier: string,
  options: { limit: number; window: Window }
): Promise<NextResponse | null> {
  try {
    await checkRateLimit(name, identifier, options);
    return null;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }
}
