import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUsage } from "@/lib/weather-ai/service";
import { requestWeatherAI, localUsageMemory } from "@/lib/weather-ai/client";

// Mock the weather-ai client
vi.mock("@/lib/weather-ai/client", () => {
  return {
    requestWeatherAI: vi.fn(),
    localUsageMemory: {
      requests_count: 0,
      ai_requests_count: 0,
      requests_limit: 1000,
      ai_requests_limit: 200,
      billing_period_end: "2026-07-29T18:11:55.000Z",
      initialized: false,
    },
  };
});

// Mock the redis client
const mockRedisStore = new Map<string, any>();
vi.mock("@/lib/cache/redis", () => {
  return {
    redis: {
      get: vi.fn(async (key: string) => mockRedisStore.get(key) ?? null),
      set: vi.fn(async (key: string, val: any) => {
        mockRedisStore.set(key, val);
        return "OK";
      }),
      incr: vi.fn(async (key: string) => {
        const cur = mockRedisStore.get(key) ? Number(mockRedisStore.get(key)) : 0;
        mockRedisStore.set(key, cur + 1);
        return cur + 1;
      }),
    },
  };
});

describe("Usage API sync and local caching logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisStore.clear();
    localUsageMemory.requests_count = 0;
    localUsageMemory.ai_requests_count = 0;
    localUsageMemory.requests_limit = 1000;
    localUsageMemory.ai_requests_limit = 200;
    localUsageMemory.initialized = false;
  });

  it("should query upstream API on the first call and cache values in Redis", async () => {
    const mockUpstreamResponse = {
      plan: "free",
      used: 42,
      limit: 1000,
      remaining: 958,
      unlimited: false,
    };

    vi.mocked(requestWeatherAI).mockResolvedValueOnce(mockUpstreamResponse);

    const usage = await getUsage();

    expect(requestWeatherAI).toHaveBeenCalledTimes(1);
    expect(requestWeatherAI).toHaveBeenCalledWith("/v1/usage");
    expect(usage.requests_count).toBe(42);
    expect(usage.ai_requests_count).toBe(0);

    // Verify it saved to Redis
    expect(mockRedisStore.get("usage:app:initialized")).toBe("true");
    expect(mockRedisStore.get("usage:app:requests_count")).toBe(42);
    expect(mockRedisStore.get("usage:app:ai_requests_count")).toBe(0);
  });

  it("should not query upstream API on subsequent calls if already initialized in Redis", async () => {
    mockRedisStore.set("usage:app:initialized", "true");
    mockRedisStore.set("usage:app:requests_count", 45);
    mockRedisStore.set("usage:app:ai_requests_count", 6);
    mockRedisStore.set("usage:app:requests_limit", 1000);
    mockRedisStore.set("usage:app:ai_requests_limit", 200);
    mockRedisStore.set("usage:app:billing_period_end", "2026-07-30T00:00:00.000Z");

    const usage = await getUsage();

    expect(requestWeatherAI).not.toHaveBeenCalled();
    expect(usage.requests_count).toBe(45);
    expect(usage.ai_requests_count).toBe(6);
  });
});
