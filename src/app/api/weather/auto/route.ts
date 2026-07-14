import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getSessionId } from "@/lib/rate-limit/identifier";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { redis, safeJsonParse } from "@/lib/cache/redis";
import { cacheKeys } from "@/lib/cache/keys";
import { singleFlight } from "@/lib/cache/single-flight";
import { getWeatherGeo } from "@/lib/weather-ai/service";
import { handleSafeError } from "@/lib/errors/response";
import { RateLimitError } from "@/lib/errors/api-error";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const sessionId = getSessionId(request);

    // 1. Check hybrid rate limit
    const rateLimit = await checkRateLimit(sessionId, ip);
    if (!rateLimit.success) {
      throw new RateLimitError("Too many requests. Please try again in a few minutes.");
    }

    // 2. Fetch from cache or upstream using single-flight
    const cacheKey = cacheKeys.weatherGeo(ip);
    
    let cachedData: any = null;
    if (redis) {
      try {
        cachedData = await redis.get(cacheKey);
      } catch (cacheErr) {
        console.error("[Cache Read Error]:", cacheErr);
      }
    }

    if (cachedData) {
      console.log(`[Cache HIT] Auto Weather for IP: ${ip}`);
      return NextResponse.json(safeJsonParse(cachedData));
    }

    console.log(`[Cache MISS] Auto Weather for IP: ${ip}`);

    // Call service layer with single-flight protection
    const freshData = await singleFlight(cacheKey, () => getWeatherGeo(ip));

    // Cache the successful response for 15 minutes (900 seconds)
    if (redis && freshData) {
      try {
        await redis.set(cacheKey, freshData, { ex: 900 });
      } catch (cacheErr) {
        console.error("[Cache Write Error]:", cacheErr);
      }
    }

    return NextResponse.json(freshData);
  } catch (error) {
    return handleSafeError(error);
  }
}
