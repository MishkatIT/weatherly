/* eslint-disable @typescript-eslint/no-explicit-any */
import { requestOWM } from "../openweather/client";
import {
  WeatherResponse,
  HourlyResponse,
  CurrentWeather,
  DailyForecast,
  HourlyForecastItem,
  WeatherAlert,
} from "./types";

function mapOWMIcon(owmIcon: string): string {
  if (!owmIcon) return "cloud";
  const base = owmIcon.substring(0, 2);
  switch (base) {
    case "01": return "sun";
    case "02":
    case "03":
    case "04": return "cloud";
    case "09":
    case "10": return "rain";
    case "11": return "thunder";
    case "13": return "snow";
    case "50": return "mist";
    default: return "cloud";
  }
}

function capitalise(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function mapWeather(weather: any[] = []): { description: string; icon: string } {
  const w = weather[0] ?? {};
  return {
    description: capitalise(w.description ?? ""),
    icon: mapOWMIcon(w.icon ?? ""),
  };
}

export function windDegToCardinal(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function aqiLabel(aqi: number): string {
  switch (aqi) {
    case 1: return "Good";
    case 2: return "Fair";
    case 3: return "Moderate";
    case 4: return "Poor";
    case 5: return "Very Poor";
    default: return "Unknown";
  }
}

export async function getWeather(lat: number, lon: number, units: string = "metric"): Promise<WeatherResponse> {
  let oneCall: any = null;
  try {
    oneCall = await requestOWM<any>("/data/3.0/onecall", {
      params: { lat, lon, units, exclude: "minutely,15minutely" },
    });
  } catch (err: any) {
    if (err?.status !== 401) throw err;
    console.warn("[OWM Service] One Call 4.0 returned 401 – falling back to data/2.5 endpoints");
  }

  if (oneCall) {
    return mapOneCallResponse(oneCall, lat, lon, units);
  }

  return getWeatherVia25(lat, lon, units);
}

async function mapOneCallResponse(raw: any, lat: number, lon: number, units: string): Promise<WeatherResponse> {
  const c = raw.current ?? {};
  const windMs = c.wind_speed ?? 0;
  const windDisplay = units === "metric" ? windMs * 3.6 : windMs;

  let aqi: number | undefined;
  try {
    const airRaw = await requestOWM<any>("/data/2.5/air_pollution", {
      params: { lat, lon },
      skipRetry: true,
    });
    aqi = airRaw?.list?.[0]?.main?.aqi;
  } catch {}

  const current: CurrentWeather = {
    temp: c.temp,
    feels_like: c.feels_like,
    humidity: c.humidity,
    wind_speed: windDisplay,
    wind_deg: c.wind_deg,
    pressure: c.pressure,
    visibility: c.visibility !== undefined ? Math.round(c.visibility / 100) / 10 : undefined,
    clouds: c.clouds,
    dew_point: c.dew_point,
    uv_index: c.uvi,
    precipitation: c.rain?.["1h"] ?? c.snow?.["1h"] ?? 0,
    sunrise: c.sunrise,
    sunset: c.sunset,
    aqi,
    ...mapWeather(c.weather),
  };

  const daily: DailyForecast[] = (raw.daily ?? []).slice(0, 8).map((d: any) => {
    const dateObj = new Date(d.dt * 1000);
    const dateStr = dateObj.toISOString().split("T")[0];
    const windDMs = d.wind_speed ?? 0;
    return {
      date: dateStr,
      day_of_week: dateObj.toLocaleDateString("en-US", { weekday: "long" }),
      temp_min: d.temp?.min ?? 0,
      temp_max: d.temp?.max ?? 0,
      temp_day: d.temp?.day,
      temp_night: d.temp?.night,
      precipitation: d.rain ?? d.snow ?? 0,
      pop: d.pop !== undefined ? Math.round(d.pop * 100) : undefined,
      uv_index: d.uvi,
      sunrise: d.sunrise,
      sunset: d.sunset,
      humidity: d.humidity,
      wind_speed: units === "metric" ? windDMs * 3.6 : windDMs,
      ...mapWeather(d.weather),
    };
  });

  const hourly: HourlyForecastItem[] = (raw.hourly ?? []).slice(0, 24).map((h: any) => {
    const timeObj = new Date(h.dt * 1000);
    const timeStr = timeObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const windHMs = h.wind_speed ?? 0;
    return {
      time: timeStr,
      temp: h.temp,
      feels_like: h.feels_like,
      precipitation: h.rain?.["1h"] ?? h.snow?.["1h"] ?? 0,
      pop: h.pop !== undefined ? Math.round(h.pop * 100) : undefined,
      wind_speed: units === "metric" ? windHMs * 3.6 : windHMs,
      humidity: h.humidity,
      ...mapWeather(h.weather),
    };
  });

  const alerts: WeatherAlert[] = (raw.alerts ?? []).map((a: any) => ({
    sender_name: a.sender_name ?? "",
    event: a.event ?? "",
    start: a.start,
    end: a.end,
    description: a.description ?? "",
  }));

  return {
    current,
    daily,
    hourly,
    alerts: alerts.length > 0 ? alerts : undefined,
    location: {
      city: undefined,
      lat: raw.lat ?? lat,
      lon: raw.lon ?? lon,
      timezone: raw.timezone,
    },
  };
}

async function getWeatherVia25(lat: number, lon: number, units: string): Promise<WeatherResponse> {
  const [currentResult, forecastResult, airResult] = await Promise.allSettled([
    requestOWM<any>("/data/2.5/weather", { params: { lat, lon, units } }),
    requestOWM<any>("/data/2.5/forecast", { params: { lat, lon, units } }),
    requestOWM<any>("/data/2.5/air_pollution", { params: { lat, lon } }),
  ]);

  if (currentResult.status === "rejected") throw currentResult.reason;

  const c = currentResult.value;
  const forecast = forecastResult.status === "fulfilled" ? forecastResult.value : null;
  const air = airResult.status === "fulfilled" ? airResult.value : null;

  const windMs = c.wind?.speed ?? 0;
  const windDisplay = units === "metric" ? windMs * 3.6 : windMs;

  const current: CurrentWeather = {
    temp: c.main.temp,
    feels_like: c.main.feels_like,
    humidity: c.main.humidity,
    wind_speed: windDisplay,
    wind_deg: c.wind?.deg,
    pressure: c.main.pressure,
    visibility: c.visibility ? Math.round(c.visibility / 100) / 10 : undefined,
    clouds: c.clouds?.all,
    precipitation: c.rain?.["1h"] ?? c.snow?.["1h"] ?? 0,
    sunrise: c.sys?.sunrise,
    sunset: c.sys?.sunset,
    aqi: air?.list?.[0]?.main?.aqi,
    ...mapWeather(c.weather),
  };

  const daily: DailyForecast[] = [];
  if (forecast?.list) {
    const byDay = new Map<string, any[]>();
    for (const slot of forecast.list) {
      const date = (slot.dt_txt as string).split(" ")[0];
      if (!byDay.has(date)) byDay.set(date, []);
      byDay.get(date)!.push(slot);
    }
    for (const [date, slots] of byDay) {
      if (daily.length >= 8) break;
      const temps = slots.map((s: any) => s.main.temp);
      const midSlot = slots[Math.floor(slots.length / 2)];
      const dateObj = new Date(date + "T12:00:00");
      const pops = slots.map((s: any) => s.pop !== undefined ? Math.round(s.pop * 100) : 0);
      const maxPop = pops.length > 0 ? Math.max(...pops) : 0;

      daily.push({
        date,
        day_of_week: dateObj.toLocaleDateString("en-US", { weekday: "long" }),
        temp_min: Math.min(...temps),
        temp_max: Math.max(...temps),
        precipitation: slots.reduce((s: number, sl: any) => s + (sl.rain?.["3h"] ?? sl.snow?.["3h"] ?? 0), 0),
        pop: maxPop,
        humidity: midSlot.main.humidity,
        wind_speed: units === "metric" ? (midSlot.wind?.speed ?? 0) * 3.6 : (midSlot.wind?.speed ?? 0),
        ...mapWeather(midSlot.weather),
      });
    }
  }

  const hourly: HourlyForecastItem[] = (forecast?.list ?? []).slice(0, 8).map((slot: any) => {
    const t = new Date(slot.dt_txt);
    return {
      time: t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      temp: slot.main.temp,
      feels_like: slot.main.feels_like,
      humidity: slot.main.humidity,
      wind_speed: units === "metric" ? (slot.wind?.speed ?? 0) * 3.6 : (slot.wind?.speed ?? 0),
      precipitation: slot.rain?.["3h"] ?? slot.snow?.["3h"] ?? 0,
      pop: slot.pop !== undefined ? Math.round(slot.pop * 100) : undefined,
      ...mapWeather(slot.weather),
    };
  });

  return {
    current,
    daily,
    hourly,
    location: {
      city: c.name,
      country: c.sys?.country,
      lat: c.coord?.lat ?? lat,
      lon: c.coord?.lon ?? lon,
      timezone: c.timezone,
    },
  };
}

export async function getHourly(lat: number, lon: number, units: string = "metric"): Promise<HourlyResponse> {
  const data = await getWeather(lat, lon, units);
  return { hourly: data.hourly ?? [] };
}

export async function getWeatherGeo(ip: string): Promise<WeatherResponse> {
  let lat = -1.2921;
  let lon = 36.8219;
  let city = "Nairobi";
  let country = "Kenya";

  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

  if (!isTest) {
    try {
      const isPrivate =
        !ip ||
        ip === "127.0.0.1" ||
        ip === "::1" ||
        ip === "localhost" ||
        ip.startsWith("10.") ||
        ip.startsWith("192.168.");

      const geoUrl = isPrivate ? "http://ip-api.com/json/" : `http://ip-api.com/json/${ip}`;

      const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData?.status === "success") {
          lat = geoData.lat;
          lon = geoData.lon;
          city = geoData.city || "Local Area";
          country = geoData.country || "Detected Location";
        }
      }
    } catch (err) {
      console.warn("[OWM Service] IP geolocation failed, using fallback:", err);
    }
  }

  const weatherData = await getWeather(lat, lon, "metric");
  weatherData.location = { city, country, lat, lon };
  return weatherData;
}