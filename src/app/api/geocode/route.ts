import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, getSessionId } from "@/lib/rate-limit/identifier";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { redis, safeJsonParse } from "@/lib/cache/redis";
import { cacheKeys } from "@/lib/cache/keys";
import { singleFlight } from "@/lib/cache/single-flight";
import { handleSafeError } from "@/lib/errors/response";
import { BadRequestError, RateLimitError, UpstreamError } from "@/lib/errors/api-error";

const geocodeQuerySchema = z.object({
  q: z.string().optional(),
  lat: z.preprocess((val) => (val === null || val === "" ? undefined : val), z.coerce.number().min(-90).max(90, { message: "Latitude must be between -90 and 90" })).optional(),
  lon: z.preprocess((val) => (val === null || val === "" ? undefined : val), z.coerce.number().min(-180).max(180, { message: "Longitude must be between -180 and 180" })).optional(),
}).refine(
  (data) => data.q !== undefined || (data.lat !== undefined && data.lon !== undefined),
  { message: "Either search query 'q' or coordinates 'lat' and 'lon' are required" }
);

export interface GeocodeResult {
  display_name: string;
  name: string;
  lat: number;
  lon: number;
  city?: string;
  state?: string;
  country?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = geocodeQuerySchema.safeParse({
      q: searchParams.get("q") || undefined,
      lat: searchParams.get("lat") || undefined,
      lon: searchParams.get("lon") || undefined,
    });

    if (!parsed.success) {
      throw new BadRequestError("Query parameter 'q' or coordinates 'lat' and 'lon' are required", parsed.error.flatten().fieldErrors);
    }

    const { q, lat, lon } = parsed.data;
    const ip = getClientIp(request);
    const sessionId = getSessionId(request);

    // 1. Check rate limits
    const rateLimit = await checkRateLimit(sessionId, ip);
    if (!rateLimit.success) {
      throw new RateLimitError("Too many requests. Please try again in a few minutes.");
    }

    // 2. Fetch from cache or upstream using single-flight
    const cacheKey = q
      ? cacheKeys.geocode(q)
      : cacheKeys.reverseGeocode(lat!, lon!);
    
    let cachedData: any = null;
    if (redis) {
      try {
        cachedData = await redis.get(cacheKey);
      } catch (cacheErr) {
        console.error("[Cache Read Error]:", cacheErr);
      }
    }

    if (cachedData) {
      console.log(`[Cache HIT] Geocoding for ${q ? `query: "${q}"` : `coords: ${lat},${lon}`}`);
      return NextResponse.json(safeJsonParse(cachedData));
    }

    console.log(`[Cache MISS] Geocoding for ${q ? `query: "${q}"` : `coords: ${lat},${lon}`}`);

    // Fetch from Nominatim API with single-flight protection
    const freshData = await singleFlight(cacheKey, async () => {
      if (q) {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.append("q", q);
        url.searchParams.append("format", "json");
        url.searchParams.append("limit", "5");
        url.searchParams.append("addressdetails", "1");
        url.searchParams.append("accept-language", "en");

        const response = await fetch(url.toString(), {
          headers: {
            // Nominatim requires a unique and descriptive User-Agent
            "User-Agent": "Weatherly-App/1.0 (contact@weatherly.app)",
          },
        });

        if (!response.ok) {
          throw new UpstreamError(response.status, "Failed to fetch geocoding data from OpenStreetMap");
        }

        const results = await response.json();
        
        // Map results to a clean and structured format
        return results.map((item: any) => {
          const address = item.address || {};
          return {
            display_name: item.display_name,
            name: address.city || address.town || address.village || address.suburb || item.name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            city: address.city || address.town || address.village,
            state: address.state,
            country: address.country,
          };
        }) as GeocodeResult[];
      } else {
        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.append("lat", String(lat));
        url.searchParams.append("lon", String(lon));
        url.searchParams.append("format", "json");
        url.searchParams.append("addressdetails", "1");
        url.searchParams.append("accept-language", "en");

        const response = await fetch(url.toString(), {
          headers: {
            // Nominatim requires a unique and descriptive User-Agent
            "User-Agent": "Weatherly-App/1.0 (contact@weatherly.app)",
          },
        });

        if (!response.ok) {
          throw new UpstreamError(response.status, "Failed to fetch reverse geocoding data from OpenStreetMap");
        }

        const result = await response.json();
        if (result.error) {
          return [];
        }

        const address = result.address || {};
        const name = address.city || address.town || address.village || address.suburb || address.neighbourhood || address.county || result.name || "Local Area";
        return [
          {
            display_name: result.display_name,
            name,
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            city: address.city || address.town || address.village,
            state: address.state,
            country: address.country,
          }
        ] as GeocodeResult[];
      }
    });

    // Cache successful geocoding response for 7 days (604800 seconds) since coordinates are stable
    if (redis && freshData && freshData.length > 0) {
      try {
        await redis.set(cacheKey, freshData, { ex: 604800 });
      } catch (cacheErr) {
        console.error("[Cache Write Error]:", cacheErr);
      }
    }

    return NextResponse.json(freshData);
  } catch (error) {
    return handleSafeError(error);
  }
}
