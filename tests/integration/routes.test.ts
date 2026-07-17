import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCurrentWeather } from "@/app/api/weather/current/route";
import { GET as getGeocode } from "@/app/api/geocode/route";
import { getWeather } from "@/lib/weather/service";
import { WeatherResponse } from "@/lib/weather/types";

// Mock the weather service layer
vi.mock("@/lib/weather/service", () => ({
  getWeather: vi.fn(),
  getWeatherGeo: vi.fn(),
  getHourly: vi.fn(),
}));

// Mock the Redis database client
vi.mock("@/lib/cache/redis", () => ({
  redis: null, // Force cache miss to hit our mocked service layer directly
}));

describe("Current Weather Route Handler Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENWEATHER_API_KEY = "openweather_test_secret_key";
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
    const mockWeatherResult: WeatherResponse = {
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
      hourly: [],
    };

    vi.mocked(getWeather).mockResolvedValueOnce(mockWeatherResult);

    const req = new NextRequest("http://localhost:3000/api/weather/current?lat=22.36&lon=91.78&ai=true");
    const res = await getCurrentWeather(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockWeatherResult);

    expect(getWeather).toHaveBeenCalledWith(22.36, 91.78, "metric");
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
