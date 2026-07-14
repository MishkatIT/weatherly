import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCurrentWeather } from "@/app/api/weather/current/route";
import { GET as getGeocode } from "@/app/api/geocode/route";
import { requestWeatherAI } from "@/lib/weather-ai/client";

// Mock the weather-ai client requests
vi.mock("@/lib/weather-ai/client", () => ({
  requestWeatherAI: vi.fn(),
}));

// Mock the Redis database client
vi.mock("@/lib/cache/redis", () => ({
  redis: null, // Force cache miss to hit our mocked service layer directly
}));

describe("Current Weather Route Handler Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAI_API_KEY = "wai_test_secret_key";
  });

  it("should return 400 Bad Request if coordinates are missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/weather/current?units=metric");
    const res = await getCurrentWeather(req);
    
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("should return 400 Bad Request if coordinates are out of bounds", async () => {
    const req = new NextRequest("http://localhost:3000/api/weather/current?lat=95&lon=100");
    const res = await getCurrentWeather(req);
    
    expect(res.status).toBe(400);
  });

  it("should return weather details successfully for valid requests", async () => {
    // Mock successful service response
    const mockWeatherResult = {
      current: {
        temp: 28.5,
        feels_like: 31.2,
        humidity: 78,
        wind_speed: 3.6,
        description: "Scattered clouds",
        icon: "cloudy",
        uv_index: 6,
        precipitation: 0.2,
      },
      daily: [
        {
          date: "2026-07-14",
          day_of_week: "Tuesday",
          temp_min: 24,
          temp_max: 30,
          description: "Scattered clouds",
          icon: "cloudy",
          precipitation: 0.2,
        },
      ],
      ai_summary: "Weather is warm and humid with scattered cloud cover.",
      is_fallback: false,
    };
    
    vi.mocked(requestWeatherAI).mockResolvedValueOnce(mockWeatherResult);

    const req = new NextRequest("http://localhost:3000/api/weather/current?lat=22.36&lon=91.78&ai=true");
    const res = await getCurrentWeather(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockWeatherResult);
    
    // Ensure the client was called with correct parameters
    expect(requestWeatherAI).toHaveBeenCalledWith("/v1/weather", {
      params: {
        lat: 22.36,
        lon: 91.78,
        units: "metric",
        days: 7,
        ai: true,
      },
    });
  });
});

describe("Geocoding Route Handler Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse location search query and proxy to Nominatim API", async () => {
    const mockNominatimResult = [
      {
        display_name: "Chattogram, Bangladesh",
        name: "Chattogram",
        lat: "22.335",
        lon: "91.831",
        address: {
          city: "Chattogram",
          country: "Bangladesh",
        },
      },
    ];

    // Mock fetch globally
    const globalFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNominatimResult,
    });
    vi.stubGlobal("fetch", globalFetchMock);

    const req = new NextRequest("http://localhost:3000/api/geocode?q=Chattogram");
    const res = await getGeocode(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual({
      display_name: "Chattogram, Bangladesh",
      name: "Chattogram",
      lat: 22.335,
      lon: 91.831,
      city: "Chattogram",
      state: undefined,
      country: "Bangladesh",
    });

    vi.unstubAllGlobals();
  });

  it("should parse coordinates and perform reverse geocoding via Nominatim API", async () => {
    const mockNominatimResult = {
      display_name: "Chattogram, Bangladesh",
      lat: "22.335",
      lon: "91.831",
      address: {
        city: "Chattogram",
        country: "Bangladesh",
      },
    };

    const globalFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNominatimResult,
    });
    vi.stubGlobal("fetch", globalFetchMock);

    const req = new NextRequest("http://localhost:3000/api/geocode?lat=22.335&lon=91.831");
    const res = await getGeocode(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual({
      display_name: "Chattogram, Bangladesh",
      name: "Chattogram",
      lat: 22.335,
      lon: 91.831,
      city: "Chattogram",
      state: undefined,
      country: "Bangladesh",
    });

    vi.unstubAllGlobals();
  });
});
