import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, getSessionId } from "@/lib/rate-limit/identifier";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { redis, safeJsonParse } from "@/lib/cache/redis";
import { cacheKeys } from "@/lib/cache/keys";
import { singleFlight } from "@/lib/cache/single-flight";
import { getWeather } from "@/lib/weather-ai/service";
import { handleSafeError } from "@/lib/errors/response";
import { BadRequestError, RateLimitError } from "@/lib/errors/api-error";

const currentQuerySchema = z.object({
  lat: z.preprocess((val) => (val === null || val === "" ? undefined : val), z.coerce.number().min(-90).max(90, { message: "Latitude must be between -90 and 90" })),
  lon: z.preprocess((val) => (val === null || val === "" ? undefined : val), z.coerce.number().min(-180).max(180, { message: "Longitude must be between -180 and 180" })),
  units: z.enum(["metric", "imperial"]).optional().default("metric"),
  days: z.coerce.number().int().min(1).max(14).optional().default(7),
  ai: z.preprocess((val) => val === "true" || val === true || val === "1", z.boolean()).optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = currentQuerySchema.safeParse({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
      units: searchParams.get("units") || undefined,
      days: searchParams.get("days") || undefined,
      ai: searchParams.get("ai") || undefined,
    });

    if (!parsed.success) {
      throw new BadRequestError(
        "Invalid coordinates or parameters",
        parsed.error.flatten().fieldErrors
      );
    }

    const { lat, lon, units, days, ai } = parsed.data;
    const ip = getClientIp(request);
    const sessionId = getSessionId(request);

    // 1. Check rate limits
    const rateLimit = await checkRateLimit(sessionId, ip);
    if (!rateLimit.success) {
      throw new RateLimitError("Too many requests. Please try again in a few minutes.");
    }

    // 2. Fetch from cache or upstream using single-flight
    const cacheKey = cacheKeys.weather({ lat, lon, units, days, ai });
    const cacheKeyTrue = cacheKeys.weather({ lat, lon, units, days, ai: true });
    
    let cachedData: any = null;
    let cachedDataTrue: any = null;
    if (redis) {
      try {
        cachedData = await redis.get(cacheKey);
        if (!ai) {
          cachedDataTrue = await redis.get(cacheKeyTrue);
        }
      } catch (cacheErr) {
        console.error("[Cache Read Error]:", cacheErr);
      }
    }

    let responseData: any = null;
    if (cachedData) {
      console.log(`[Cache HIT] Weather for coords: ${lat},${lon}`);
      responseData = safeJsonParse(cachedData);
    } else {
      console.log(`[Cache MISS] Weather for coords: ${lat},${lon}`);
      // Call service layer with single-flight protection
      const freshData = await singleFlight(cacheKey, () =>
        getWeather(lat, lon, units, days, ai)
      );
      responseData = freshData;

      // Cache successful weather response for 10 minutes (600 seconds)
      if (redis && freshData) {
        try {
          await redis.set(cacheKey, freshData, { ex: 600 });
        } catch (cacheErr) {
          console.error("[Cache Write Error]:", cacheErr);
        }
      }
    }

    // Merge cached AI summary if available (its presence means the user generated it)
    if (!ai && cachedDataTrue && responseData) {
      const parsedTrue = safeJsonParse(cachedDataTrue);
      if (parsedTrue && parsedTrue.ai_summary) {
        responseData.ai_summary = parsedTrue.ai_summary;
        responseData.is_fallback = false;
      }
    }

    return NextResponse.json(responseData);
  } catch (error) {
    return handleSafeError(error);
  }
}
