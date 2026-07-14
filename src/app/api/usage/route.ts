import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getSessionId } from "@/lib/rate-limit/identifier";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { redis, safeJsonParse } from "@/lib/cache/redis";
import { cacheKeys } from "@/lib/cache/keys";
import { singleFlight } from "@/lib/cache/single-flight";
import { getUsage } from "@/lib/weather-ai/service";
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

    const cacheKey = cacheKeys.usage();
    
    let cachedData: any = null;
    if (redis) {
      try {
        cachedData = await redis.get(cacheKey);
      } catch (cacheErr) {
        console.error("[Cache Read Error]:", cacheErr);
      }
    }

    if (cachedData) {
      const parsedData = safeJsonParse(cachedData);
      if (parsedData && typeof parsedData === "object" && typeof parsedData.requests_count === "number") {
        console.log("[Cache HIT] API global usage metrics retrieved");
        return NextResponse.json(parsedData);
      }
    }

    console.log("[Cache MISS] Fetching global usage metrics from upstream");

    // Fetch from service with single-flight protection
    const freshData = await singleFlight(cacheKey, () => getUsage());

    // Cache successful usage response for 5 minutes (300 seconds)
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
