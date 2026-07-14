import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../cache/redis";

// Check if Upstash Redis is initialized, otherwise fallback to bypass rate limiting
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const mockLimiter = {
  limit: async () => ({
    success: true,
    limit: 1000,
    remaining: 1000,
    reset: Date.now() + 15 * 60 * 1000,
  }),
};

// Create the limiters using Upstash sliding window algorithm
export const sessionApiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "15 m"),
      analytics: true,
      prefix: "@ratelimit:session:api",
    })
  : mockLimiter;

export const ipApiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(500, "15 m"),
      analytics: true,
      prefix: "@ratelimit:ip:api",
    })
  : mockLimiter;

export const sessionUploadLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: true,
      prefix: "@ratelimit:session:upload",
    })
  : mockLimiter;

export const ipUploadLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "15 m"),
      analytics: true,
      prefix: "@ratelimit:ip:upload",
    })
  : mockLimiter;

/**
 * Checks rate limits for general API requests under a hybrid strategy.
 * Checks both session-level limit and broad IP abuse guard.
 */
export async function checkRateLimit(
  sessionId: string,
  ip: string
): Promise<RateLimitResult> {
  // 1. Session rate limit
  const sessionResult = await sessionApiLimiter.limit(sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  // 2. IP rate limit (abuse guard)
  const ipResult = await ipApiLimiter.limit(ip);
  return ipResult;
}

/**
 * Checks rate limits for file uploads.
 * Checks both session-level limit and broad IP abuse guard.
 */
export async function checkUploadRateLimit(
  sessionId: string,
  ip: string
): Promise<RateLimitResult> {
  // 1. Session upload limit
  const sessionResult = await sessionUploadLimiter.limit(sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  // 2. IP upload limit
  const ipResult = await ipUploadLimiter.limit(ip);
  return ipResult;
}
