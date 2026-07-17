import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, getSessionId } from "@/lib/rate-limit/identifier";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { redis, safeJsonParse } from "@/lib/cache/redis";
import { cacheKeys } from "@/lib/cache/keys";
import { singleFlight } from "@/lib/cache/single-flight";
import { getHourly } from "@/lib/weather-ai/service";
import { handleSafeError } from "@/lib/errors/response";
import { BadRequestError, RateLimitError } from "@/lib/errors/api-error";

const hourlyQuerySchema = z.object({
  lat: z.preprocess((val) => (val === null || val === "" ? undefined : val), z.coerce.number().min(-90).max(90, { message: "Latitude must be between -90 and 90" })),
  lon: z.preprocess((val) => (val === null || val === "" ? undefined : val), z.coerce.number().min(-180).max(180, { message: "Longitude must be between -180 and 180" })),
  units: z.enum(["metric", "imperial"]).optional().default("metric"),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = hourlyQuerySchema.safeParse({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
      units: searchParams.get("units") || undefined,
    });

    if (!parsed.success) {
      throw new BadRequestError(
        "Invalid coordinates or parameters",
        parsed.error.flatten().fieldErrors
      );
    }

    const { lat, lon, units } = parsed.data;
    const ip = getClientIp(request);
    const sessionId = getSessionId(request);

    // 1. Check rate limits
    const rateLimit = await checkRateLimit(sessionId, ip);
    if (!rateLimit.success) {
      throw new RateLimitError("Too many requests. Please try again in a few minutes.");
    }

    // 2. Fetch from cache or upstream using single-flight
    const cacheKey = cacheKeys.hourly(lat, lon, units);

    let cachedData: any = null;
    if (redis) {
      try {
        cachedData = await redis.get(cacheKey);
      } catch (cacheErr) {
        console.error("[Cache Read Error]:", cacheErr);
      }
    }

    if (cachedData) {
      console.log(`[Cache HIT] Hourly Weather for coords: ${lat},${lon}`);
      return NextResponse.json(safeJsonParse(cachedData));
    }

    console.log(`[Cache MISS] Hourly Weather for coords: ${lat},${lon}`);

    const freshData = await singleFlight(cacheKey, () => getHourly(lat, lon, units));

    if (redis && freshData) {
      try {
        await redis.set(cacheKey, freshData, { ex: 600 });
      } catch (cacheErr) {
        console.error("[Cache Write Error]:", cacheErr);
      }
    }

    return NextResponse.json(freshData);
  } catch (error) {
    return handleSafeError(error);
  }
}
