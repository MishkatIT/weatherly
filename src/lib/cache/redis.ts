import { Redis } from "@upstash/redis";

// Check if credentials are present. If not, log a warning, but don't crash the server start,
// since this can run in local/test environments. We will handle fallback gracefully.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;

if (redisUrl && redisToken) {
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
} else {
  console.warn(
    "[Redis Cache Warning]: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set. Caching will be disabled."
  );
}

export function safeJsonParse(val: any): any {
  let current = val;
  while (typeof current === "string") {
    try {
      const parsed = JSON.parse(current);
      if (parsed === current) {
        break;
      }
      current = parsed;
    } catch (_) {
      break;
    }
  }
  return current;
}

export { redis };
