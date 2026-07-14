import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getSessionId } from "@/lib/rate-limit/identifier";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { redis, safeJsonParse } from "@/lib/cache/redis";
import { getTreesQuota } from "@/lib/weather-ai/service";
import { handleSafeError } from "@/lib/errors/response";
import { RateLimitError } from "@/lib/errors/api-error";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const sessionId = getSessionId(request);

    // 1. Check rate limits
    const rateLimit = await checkRateLimit(sessionId, ip);
    if (!rateLimit.success) {
      throw new RateLimitError("Too many requests. Please try again in a few minutes.");
    }

    const cacheKey = "trees:quota:global";
    
    let cachedData: any = null;
    if (redis) {
      try {
        cachedData = await redis.get(cacheKey);
      } catch (cacheErr) {
        console.error("[Cache Read Error]:", cacheErr);
      }
    }

    if (cachedData) {
      console.log("[Cache HIT] Trees quota retrieved");
      return NextResponse.json(safeJsonParse(cachedData));
    }

    console.log("[Cache MISS] Fetching trees quota from upstream");

    const freshData = await getTreesQuota();

    // Cache successful quota response for 5 minutes (300 seconds)
    if (redis && freshData) {
      try {
        await redis.set(cacheKey, freshData, { ex: 300 });
      } catch (cacheErr) {
        console.error("[Cache Write Error]:", cacheErr);
      }
    }

    return NextResponse.json(freshData);
  } catch (error) {
    return handleSafeError(error);
  }
}
