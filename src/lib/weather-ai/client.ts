import { ApiError, UpstreamError, UpstreamTimeoutError, RateLimitError } from "../errors/api-error";
import { redis } from "../cache/redis";

export const localUsageMemory = {
  requests_count: 0,
  ai_requests_count: 0,
  requests_limit: 1000,
  ai_requests_limit: 200,
  billing_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  initialized: false,
};

const BASE_URL = "https://api.weather-ai.co";
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipRetry?: boolean;
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestWeatherAI<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, skipRetry, ...init } = options;
  const apiKey = process.env.WAI_API_KEY;

  if (!apiKey) {
    throw new ApiError(500, "CONFIG_ERROR", "WeatherAI API key is missing on the server.");
  }

  // Construct URL with query parameters
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (!(init.body instanceof FormData)) {
    headers.set("Accept", "application/json");
  }

  let attempt = 0;
  let backoff = INITIAL_BACKOFF_MS;

  while (true) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        ...init,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Track usage locally to avoid calling the upstream /v1/usage endpoint
        if (endpoint !== "/v1/usage") {
          if (redis) {
            try {
              await redis.incr("usage:app:requests_count");
              const isAI = url.searchParams.get("ai") === "true" || endpoint.includes("/trees/analyze");
              if (isAI) {
                await redis.incr("usage:app:ai_requests_count");
              }
              // Invalidate cached global usage payload to force a fresh retrieval next time
              await redis.del("usage:global");
            } catch (err) {
              console.error("[Usage Track Error]:", err);
            }
          } else {
            localUsageMemory.requests_count++;
            const isAI = url.searchParams.get("ai") === "true" || endpoint.includes("/trees/analyze");
            if (isAI) {
              localUsageMemory.ai_requests_count++;
            }
          }
        }

        return (await response.json()) as T;
      }

      // Handle failed HTTP responses
      const status = response.status;
      let errorBody: any = {};
      try {
        errorBody = await response.json();
      } catch (_) {
        // Response is not JSON
      }

      const errorMessage = errorBody?.error?.message || errorBody?.message || `Upstream API returned status ${status}`;

      // Check if transient error and we have retries left
      const isTransient = [429, 502, 503, 504].includes(status);
      if (isTransient && attempt <= MAX_RETRIES && !skipRetry) {
        let waitTime = backoff;
        if (status === 429) {
          const retryAfterHeader = response.headers.get("Retry-After");
          if (retryAfterHeader) {
            const parsed = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsed)) {
              waitTime = parsed * 1000;
            }
          }
        }
        console.warn(`[WeatherAI Client] Attempt ${attempt} failed with status ${status}. Retrying in ${waitTime}ms...`);
        await delay(waitTime);
        backoff *= 2; // Exponential backoff
        continue;
      }

      // If we got here, it's either not transient or we ran out of retries
      if (status === 429) {
        throw new RateLimitError(errorMessage);
      }
      throw new UpstreamError(status, errorMessage);

    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        if (attempt <= MAX_RETRIES && !skipRetry) {
          console.warn(`[WeatherAI Client] Attempt ${attempt} timed out. Retrying in ${backoff}ms...`);
          await delay(backoff);
          backoff *= 2;
          continue;
        }
        throw new UpstreamTimeoutError();
      }

      // If it's already an ApiError, rethrow it
      if (error instanceof ApiError) {
        throw error;
      }

      // Other network errors
      if (attempt <= MAX_RETRIES && !skipRetry) {
        console.warn(`[WeatherAI Client] Attempt ${attempt} failed with network error: ${error.message}. Retrying in ${backoff}ms...`);
        await delay(backoff);
        backoff *= 2;
        continue;
      }

      throw new UpstreamError(500, `Network failure or configuration error: ${error.message}`);
    }
  }
}
