import { ApiError, UpstreamError, UpstreamTimeoutError, RateLimitError } from "../errors/api-error";

const BASE_URL = "https://api.openweathermap.org";
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

interface FetchOptions {
  params?: Record<string, string | number | boolean | undefined>;
  skipRetry?: boolean;
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestOWM<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, skipRetry } = options;
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    throw new ApiError(500, "CONFIG_ERROR", "OpenWeatherMap API key is missing on the server.");
  }

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append("appid", apiKey);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  let attempt = 0;
  let backoff = INITIAL_BACKOFF_MS;

  while (true) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return (await response.json()) as T;
      }

      const status = response.status;
      let errorBody: any = {};
      try {
        errorBody = await response.json();
      } catch (_) {}

      const errorMessage =
        errorBody?.message ||
        `OpenWeatherMap API returned status ${status}`;

      const isTransient = [429, 502, 503, 504].includes(status);
      if (isTransient && attempt <= MAX_RETRIES && !skipRetry) {
        let waitTime = backoff;
        if (status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          if (retryAfter) {
            const parsed = parseInt(retryAfter, 10);
            if (!isNaN(parsed)) waitTime = parsed * 1000;
          }
        }
        console.warn(`[OWM Client] Attempt ${attempt} failed with status ${status}. Retrying in ${waitTime}ms...`);
        await delay(waitTime);
        backoff *= 2;
        continue;
      }

      if (status === 429) throw new RateLimitError(errorMessage);
      throw new UpstreamError(status, errorMessage);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        if (attempt <= MAX_RETRIES && !skipRetry) {
          console.warn(`[OWM Client] Attempt ${attempt} timed out. Retrying in ${backoff}ms...`);
          await delay(backoff);
          backoff *= 2;
          continue;
        }
        throw new UpstreamTimeoutError();
      }

      if (error instanceof ApiError) throw error;

      if (attempt <= MAX_RETRIES && !skipRetry) {
        console.warn(`[OWM Client] Attempt ${attempt} network error: ${error.message}. Retrying in ${backoff}ms...`);
        await delay(backoff);
        backoff *= 2;
        continue;
      }

      throw new UpstreamError(500, `Network failure: ${error.message}`);
    }
  }
}
