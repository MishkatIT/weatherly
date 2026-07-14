import { requestWeatherAI, localUsageMemory } from "./client";
import { redis } from "../cache/redis";
import { WeatherResponse, HourlyResponse, TreeAnalysisResult, TreesQuotaResponse, UsageResponse, CurrentWeather, DailyForecast } from "./types";

function mapWeatherCode(code: number): { description: string; icon: string } {
  switch (code) {
    case 0:
      return { description: "Clear sky", icon: "sun" };
    case 1:
      return { description: "Mainly clear", icon: "sun" };
    case 2:
      return { description: "Partly cloudy", icon: "cloud" };
    case 3:
      return { description: "Overcast", icon: "cloud" };
    case 45:
    case 48:
      return { description: "Foggy", icon: "cloud" };
    case 51:
      return { description: "Light drizzle", icon: "rain" };
    case 53:
      return { description: "Moderate drizzle", icon: "rain" };
    case 55:
      return { description: "Dense drizzle", icon: "rain" };
    case 56:
    case 57:
      return { description: "Freezing drizzle", icon: "rain" };
    case 61:
      return { description: "Slight rain", icon: "rain" };
    case 63:
      return { description: "Moderate rain", icon: "rain" };
    case 65:
      return { description: "Heavy rain", icon: "rain" };
    case 66:
    case 67:
      return { description: "Freezing rain", icon: "rain" };
    case 71:
      return { description: "Slight snow fall", icon: "snow" };
    case 73:
      return { description: "Moderate snow fall", icon: "snow" };
    case 75:
      return { description: "Heavy snow fall", icon: "snow" };
    case 77:
      return { description: "Snow grains", icon: "snow" };
    case 80:
      return { description: "Slight rain showers", icon: "rain" };
    case 81:
      return { description: "Moderate rain showers", icon: "rain" };
    case 82:
      return { description: "Violent rain showers", icon: "rain" };
    case 85:
    case 86:
      return { description: "Snow showers", icon: "snow" };
    case 95:
      return { description: "Thunderstorm", icon: "thunder" };
    case 96:
    case 99:
      return { description: "Thunderstorm with hail", icon: "thunder" };
    default:
      return { description: "Cloudy", icon: "cloud" };
  }
}

function generateFallbackSummary(current: any): string {
  const temp = Math.round(current.temp);
  const desc = current.description.toLowerCase();
  const wind = current.wind_speed;
  
  let summary = `Currently, it's ${temp}°C and ${desc}. `;
  if (temp > 28) {
    summary += "It is quite warm outside, so stay hydrated. ";
  } else if (temp < 12) {
    summary += "It is chilly, so bundle up if you are heading out. ";
  } else {
    summary += "The temperature is moderate and comfortable. ";
  }
  
  if (desc.includes("rain") || desc.includes("drizzle")) {
    summary += "Carry an umbrella as wet conditions are expected. ";
  } else if (desc.includes("clear") || desc.includes("sun")) {
    summary += "Enjoy the clear skies and sunshine! ";
  }
  
  if (wind > 15) {
    summary += "Expect breezy conditions with gusty winds.";
  }
  
  return summary;
}

function estimateHumidity(code: number, temp: number): number {
  if ([0, 1].includes(code)) {
    return temp > 30 ? 40 : 50;
  }
  if (code === 2) {
    return temp > 30 ? 50 : 60;
  }
  if (code === 3) {
    return 70;
  }
  if ([45, 48].includes(code)) {
    return 95;
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return 85;
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return 80;
  }
  if ([95, 96, 99].includes(code)) {
    return 90;
  }
  return 65;
}

function calculateFeelsLike(temp: number, humidity: number, windSpeedKmh: number): number {
  if (temp <= 10) {
    // 1. Cold Range: Wind Chill Index
    if (windSpeedKmh > 4.8) {
      const v = windSpeedKmh;
      const feelsLike = 13.12 + 0.6215 * temp - 11.37 * Math.pow(v, 0.16) + 0.3965 * temp * Math.pow(v, 0.16);
      return Math.round(feelsLike * 10) / 10;
    }
    return temp; // No wind chill if wind is calm
  } else if (temp >= 20) {
    // 2. Warm Range: Apparent Temperature (Steadman)
    const wsMs = windSpeedKmh / 3.6;
    const e = (humidity / 100) * 6.105 * Math.exp((17.27 * temp) / (237.7 + temp));
    const feelsLike = temp + 0.33 * e - 0.7 * wsMs - 4.0;
    return Math.round(Math.max(temp - 3, feelsLike) * 10) / 10;
  } else {
    // 3. Transition Range (10°C to 20°C): Smooth linear interpolation
    const coldFeels = temp;
    const wsMs = windSpeedKmh / 3.6;
    const e = (humidity / 100) * 6.105 * Math.exp((17.27 * temp) / (237.7 + temp));
    const warmFeels = temp + 0.33 * e - 0.7 * wsMs - 4.0;
    
    const weight = (temp - 10) / 10; // 0 at 10°C, 1 at 20°C
    const feelsLike = coldFeels * (1 - weight) + warmFeels * weight;
    return Math.round(feelsLike * 10) / 10;
  }
}

function estimateUvIndex(code: number, timeStr?: string): number {
  if (timeStr) {
    try {
      const hour = new Date(timeStr).getHours();
      if (hour < 6 || hour > 18) return 0;
      const distFromNoon = Math.abs(hour - 12);
      let baseUv = Math.max(0, 10 - distFromNoon * 2);
      if ([3, 45, 48].includes(code)) {
        baseUv *= 0.3;
      } else if (code === 2) {
        baseUv *= 0.7;
      } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 71, 73, 75, 77, 85, 86, 95, 96, 99].includes(code)) {
        baseUv *= 0.15;
      }
      return Math.round(baseUv);
    } catch (_) {}
  }
  if ([0, 1].includes(code)) return 6;
  if (code === 2) return 4;
  if (code === 3) return 2;
  return 1;
}

function mapWeatherResponse(raw: any): WeatherResponse {
  if (!raw) return raw;

  const rawCurrent = raw.current || {};
  const { description: defaultDesc, icon: defaultIcon } = mapWeatherCode(rawCurrent.weathercode ?? 0);
  
  const temp = rawCurrent.temp !== undefined ? rawCurrent.temp : (rawCurrent.temperature ?? 0);
  const wind_speed = rawCurrent.wind_speed !== undefined ? rawCurrent.wind_speed : (rawCurrent.windspeed ?? 0);
  const code = rawCurrent.weathercode ?? 0;
  const humidity = rawCurrent.humidity !== undefined ? rawCurrent.humidity : estimateHumidity(code, temp);
  const feels_like = rawCurrent.feels_like !== undefined ? rawCurrent.feels_like : calculateFeelsLike(temp, humidity, wind_speed);
  
  const current: CurrentWeather = {
    temp,
    feels_like,
    humidity,
    wind_speed,
    description: rawCurrent.description ?? defaultDesc,
    icon: rawCurrent.icon ?? defaultIcon,
  };

  current.uv_index = rawCurrent.uv_index !== undefined ? rawCurrent.uv_index : estimateUvIndex(code, rawCurrent.time);

  let currentPrecipitation = 0;
  if (rawCurrent.precipitation !== undefined) {
    currentPrecipitation = rawCurrent.precipitation;
  } else if (raw.hourly && raw.hourly.length > 0) {
    const currentHourStr = rawCurrent.time ? rawCurrent.time.substring(0, 13) + ":00" : "";
    const matchedHour = raw.hourly.find((h: any) => h.time.startsWith(currentHourStr));
    if (matchedHour && matchedHour.precipitation !== undefined) {
      currentPrecipitation = matchedHour.precipitation;
    } else if (raw.daily && raw.daily[0] && raw.daily[0].precipitation !== undefined) {
      currentPrecipitation = raw.daily[0].precipitation;
    }
  } else if (raw.daily && raw.daily[0] && raw.daily[0].precipitation !== undefined) {
    currentPrecipitation = raw.daily[0].precipitation;
  }
  current.precipitation = currentPrecipitation;

  const daily: DailyForecast[] = (raw.daily ?? []).map((day: any) => {
    const { description: dayDesc, icon: dayIcon } = mapWeatherCode(day.weathercode ?? 0);
    const dateObj = new Date(day.date);
    const dayOfWeek = isNaN(dateObj.getTime())
      ? "Unknown"
      : dateObj.toLocaleDateString("en-US", { weekday: "long" });

    return {
      date: day.date,
      day_of_week: day.day_of_week ?? dayOfWeek,
      temp_min: day.temp_min,
      temp_max: day.temp_max,
      description: day.description ?? dayDesc,
      icon: day.icon ?? dayIcon,
      precipitation: day.precipitation ?? 0,
    };
  });

  const response: WeatherResponse = {
    current,
    daily,
  };

  if (raw.location !== undefined || raw.lat !== undefined || raw.lon !== undefined) {
    response.location = {
      city: raw.location?.city ?? "Local Area",
      country: raw.location?.country ?? "Detected Location",
      lat: raw.location?.lat ?? raw.lat ?? 0,
      lon: raw.location?.lon ?? raw.lon ?? 0,
    };
  }

  if (raw.ai_summary !== undefined && raw.ai_summary !== null) {
    response.ai_summary = raw.ai_summary;
    response.is_fallback = false;
  } else if (raw.current !== undefined) {
    response.ai_summary = generateFallbackSummary(current);
    response.is_fallback = true;
  }

  return response;
}

function mapHourlyResponse(raw: any): HourlyResponse {
  if (!raw || !Array.isArray(raw.hourly)) return raw;

  const hourly = raw.hourly.map((hour: any) => {
    const { description, icon } = mapWeatherCode(hour.weathercode ?? 0);
    return {
      time: hour.time,
      temp: hour.temp,
      description: hour.description ?? description,
      icon: hour.icon ?? icon,
      precipitation: hour.precipitation ?? 0,
    };
  });

  return { hourly };
}

export async function getWeatherGeo(ip: string): Promise<WeatherResponse> {
  let lat = -1.2921; // Nairobi fallback
  let lon = 36.8219;
  let city = "Nairobi";
  let country = "Kenya";
  let resolvedGeo = false;

  // Don't execute external GeoIP requests during testing
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    try {
      const isPrivate = !ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip.startsWith("10.") || ip.startsWith("192.168.");
      const geoUrl = isPrivate ? "http://ip-api.com/json/" : `http://ip-api.com/json/${ip}`;
      const geoRes = await fetch(geoUrl);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && geoData.status === "success") {
          lat = geoData.lat;
          lon = geoData.lon;
          city = geoData.city || "Local Area";
          country = geoData.country || "Detected Location";
          resolvedGeo = true;
        }
      }
    } catch (err) {
      console.warn("[WeatherAI Service] ip-api.com resolution failed, falling back to upstream weather-geo:", err);
    }
  }

  if (resolvedGeo) {
    // Fetch the actual weather for these coordinates
    const weatherData = await getWeather(lat, lon, "metric", 7, false);
    // Inject the resolved location
    weatherData.location = {
      city,
      country,
      lat,
      lon,
    };
    return weatherData;
  }

  const raw = await requestWeatherAI<any>("/v1/weather-geo", {
    params: { ip },
  });
  const mapped = mapWeatherResponse(raw);

  // If we have coordinates, reverse geocode to resolve city and country
  if (mapped.location && mapped.location.lat && mapped.location.lon && process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.append("lat", String(mapped.location.lat));
      url.searchParams.append("lon", String(mapped.location.lon));
      url.searchParams.append("format", "json");
      url.searchParams.append("addressdetails", "1");
      url.searchParams.append("accept-language", "en");

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "Weatherly-App/1.0 (contact@weatherly.app)",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const address = data.address || {};
        mapped.location.city = address.city || address.town || address.village || address.suburb || address.county || "Local Area";
        mapped.location.country = address.country || "Detected Location";
      }
    } catch (err) {
      console.warn("[WeatherAI Service] Reverse geocoding failed:", err);
    }
  }

  return mapped;
}

export async function getWeather(
  lat: number,
  lon: number,
  units: string = "metric",
  days: number = 7,
  ai: boolean = true
): Promise<WeatherResponse> {
  const raw = await requestWeatherAI<any>("/v1/weather", {
    params: {
      lat,
      lon,
      units,
      days,
      ai,
    },
  });
  return mapWeatherResponse(raw);
}

export async function getHourly(
  lat: number,
  lon: number,
  units: string = "metric"
): Promise<HourlyResponse> {
  const raw = await requestWeatherAI<any>("/v1/hourly", {
    params: {
      lat,
      lon,
      units,
      ai: false,
    },
  });
  return mapHourlyResponse(raw);
}

export async function analyzeTreeImage(
  imageFile: File,
  acres?: number,
  farmerId?: string,
  county?: string,
  notes?: string
): Promise<TreeAnalysisResult> {
  const formData = new FormData();
  formData.append("image", imageFile);
  
  if (acres !== undefined) {
    formData.append("landAcres", String(acres));
  }
  if (farmerId) {
    formData.append("farmerId", farmerId);
  }
  if (county) {
    formData.append("county", county);
  }
  if (notes) {
    formData.append("notes", notes);
  }

  return requestWeatherAI<TreeAnalysisResult>("/v1/trees/analyze", {
    method: "POST",
    body: formData,
    // Since analyzing tree images might be non-idempotent or slow, we don't automatically retry it.
    skipRetry: true, 
  });
}

export async function getTreesQuota(): Promise<TreesQuotaResponse> {
  try {
    return await requestWeatherAI<TreesQuotaResponse>("/v1/trees/quota");
  } catch (error: any) {
    if (error && error.code === "CONFIG_ERROR") {
      throw error;
    }
    console.warn("[WeatherAI Service] /v1/trees/quota returned an error. Using fallback quota.", error);
    return {
      remaining_uploads: 5,
      limit_uploads: 5,
      reset_time: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

export async function getUsage(): Promise<UsageResponse> {
  // We want to fetch the correct usage from upstream if not initialized/cached yet.
  // After the first time, we only use/increment the application-side metrics stored in Redis/memory.
  let requests_count = 0;
  let ai_requests_count = 0;
  let requests_limit = 1000;
  let ai_requests_limit = 200;
  let billing_period_end = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  if (redis) {
    try {
      const initialized = await redis.get<any>("usage:app:initialized");
      if (initialized === "true" || initialized === true) {
        const storedReq = await redis.get<number>("usage:app:requests_count");
        const storedAI = await redis.get<number>("usage:app:ai_requests_count");
        const storedReqLimit = await redis.get<number>("usage:app:requests_limit");
        const storedAILimit = await redis.get<number>("usage:app:ai_requests_limit");
        const storedBillingEnd = await redis.get<string>("usage:app:billing_period_end");

        requests_count = storedReq !== null ? Number(storedReq) : 0;
        ai_requests_count = storedAI !== null ? Number(storedAI) : 0;
        if (storedReqLimit !== null) requests_limit = Number(storedReqLimit);
        if (storedAILimit !== null) ai_requests_limit = Number(storedAILimit);
        if (storedBillingEnd !== null) billing_period_end = storedBillingEnd;
      } else {
        // Fetch from upstream for the first time
        try {
          const upstream = await requestWeatherAI<any>("/v1/usage");
          requests_count = typeof upstream.used === "number" ? upstream.used : 0;
          requests_limit = typeof upstream.limit === "number" ? upstream.limit : 1000;
          ai_requests_count = 0;
          ai_requests_limit = 200;
          billing_period_end = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

          await redis.set("usage:app:requests_count", requests_count);
          await redis.set("usage:app:ai_requests_count", ai_requests_count);
          await redis.set("usage:app:requests_limit", requests_limit);
          await redis.set("usage:app:ai_requests_limit", ai_requests_limit);
          await redis.set("usage:app:billing_period_end", billing_period_end);
          await redis.set("usage:app:initialized", "true");
        } catch (apiErr) {
          console.error("[WeatherAI Service] Failed to initialize usage from upstream API:", apiErr);
        }
      }
    } catch (err) {
      console.error("[WeatherAI Service] Failed to read/write usage in Redis, falling back to local memory:", err);
      // Fallback to local memory
      if (localUsageMemory.initialized) {
        requests_count = localUsageMemory.requests_count;
        ai_requests_count = localUsageMemory.ai_requests_count;
        requests_limit = localUsageMemory.requests_limit;
        ai_requests_limit = localUsageMemory.ai_requests_limit;
        billing_period_end = localUsageMemory.billing_period_end;
      } else {
        try {
          const upstream = await requestWeatherAI<any>("/v1/usage");
          requests_count = typeof upstream.used === "number" ? upstream.used : 0;
          requests_limit = typeof upstream.limit === "number" ? upstream.limit : 1000;
          ai_requests_count = 0;
          ai_requests_limit = 200;
          billing_period_end = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

          localUsageMemory.requests_count = requests_count;
          localUsageMemory.ai_requests_count = ai_requests_count;
          localUsageMemory.requests_limit = requests_limit;
          localUsageMemory.ai_requests_limit = ai_requests_limit;
          localUsageMemory.billing_period_end = billing_period_end;
          localUsageMemory.initialized = true;
        } catch (apiErr) {
          console.error("[WeatherAI Service] Failed to initialize usage from upstream API for local memory:", apiErr);
        }
      }
    }
  } else {
    // Redis is null, use local memory
    if (localUsageMemory.initialized) {
      requests_count = localUsageMemory.requests_count;
      ai_requests_count = localUsageMemory.ai_requests_count;
      requests_limit = localUsageMemory.requests_limit;
      ai_requests_limit = localUsageMemory.ai_requests_limit;
      billing_period_end = localUsageMemory.billing_period_end;
    } else {
      try {
        const upstream = await requestWeatherAI<any>("/v1/usage");
        requests_count = typeof upstream.used === "number" ? upstream.used : 0;
        requests_limit = typeof upstream.limit === "number" ? upstream.limit : 1000;
        ai_requests_count = 0;
        ai_requests_limit = 200;
        billing_period_end = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

        localUsageMemory.requests_count = requests_count;
        localUsageMemory.ai_requests_count = ai_requests_count;
        localUsageMemory.requests_limit = requests_limit;
        localUsageMemory.ai_requests_limit = ai_requests_limit;
        localUsageMemory.billing_period_end = billing_period_end;
        localUsageMemory.initialized = true;
      } catch (apiErr) {
        console.error("[WeatherAI Service] Failed to initialize usage from upstream API without Redis:", apiErr);
      }
    }
  }

  return {
    requests_count,
    requests_limit,
    ai_requests_count,
    ai_requests_limit,
    billing_period_end,
  };
}
