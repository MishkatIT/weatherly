import { describe, it, expect, vi } from "vitest";
import { cacheKeys } from "@/lib/cache/keys";
import { getClientIp } from "@/lib/rate-limit/identifier";
import { ApiError } from "@/lib/errors/api-error";
import { handleSafeError } from "@/lib/errors/response";
import { NextRequest } from "next/server";

describe("Cache Key Generation Helper", () => {
  it("should round coordinates to 2 decimal places and serialize properties", () => {
    const key = cacheKeys.weather({
      lat: 22.36482,
      lon: 91.78284,
      units: "metric",
      days: 7,
      ai: true,
    });
    expect(key).toBe("weather:current:22.36:91.78:metric:7:true");
  });

  it("should normalize geocoding search terms to lowercase and trim spaces", () => {
    const key = cacheKeys.geocode("  Chattogram  ");
    expect(key).toBe("geocode:chattogram");
  });
});

describe("Client IP Resolution", () => {
  it("should resolve the first IP in x-forwarded-for header", () => {
    const request = new NextRequest("http://localhost:3000/", {
      headers: {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      },
    });
    const ip = getClientIp(request);
    expect(ip).toBe("203.0.113.195");
  });

  it("should fallback to x-real-ip if x-forwarded-for is missing", () => {
    const request = new NextRequest("http://localhost:3000/", {
      headers: {
        "x-real-ip": "198.51.100.12",
      },
    });
    const ip = getClientIp(request);
    expect(ip).toBe("198.51.100.12");
  });

  it("should fallback to local IP if both headers are missing", () => {
    const request = new NextRequest("http://localhost:3000/");
    const ip = getClientIp(request);
    expect(ip).toBe("127.0.0.1");
  });
});

describe("API Error Normalization Handler", () => {
  it("should return the exact status and structure for customized ApiError", async () => {
    const customError = new ApiError(403, "TEST_FORBIDDEN", "Forbidden test action");
    const response = handleSafeError(customError);
    
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json).toEqual({
      error: {
        code: "TEST_FORBIDDEN",
        message: "Forbidden test action",
        details: undefined,
      },
    });
  });

  it("should return a generic 500 INTERNAL_SERVER_ERROR for unhandled runtime exceptions", async () => {
    const unknownError = new Error("Database crashed or connection timed out");
    const response = handleSafeError(unknownError);
    
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(json.error.message).toBe("An unexpected error occurred. Please try again later.");
    expect(json.error.message).not.toContain("Database crashed"); // Stack details hidden
  });
});
