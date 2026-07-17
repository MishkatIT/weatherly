import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { redis, safeJsonParse } from "@/lib/cache/redis";
import { getWeather } from "@/lib/weather/service";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    const { lat, lon } = parsed.data;
    const forceRefresh = searchParams.get("force") === "true";

    // Check Redis cache first, unless forceRefresh is requested
    const cacheKey = `weather:ai:summary:${lat.toFixed(2)}:${lon.toFixed(2)}`;
    if (redis && !forceRefresh) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json({ summary: safeJsonParse(cached) });
      }
    }

    const weather = await getWeather(lat, lon, "metric");
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "openrouter/free";

    if (!openRouterKey) {
      return NextResponse.json({ error: "AI service key is missing on the server" }, { status: 500 });
    }

    // Resolve local date and time based on timezone offset/identifier
    let localTimeStr = "";
    let localDateStr = "";
    try {
      const tz = weather.location?.timezone;
      if (typeof tz === "string") {
        localTimeStr = new Date().toLocaleTimeString("en-US", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        localDateStr = new Date().toLocaleDateString("en-US", {
          timeZone: tz,
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      } else if (typeof tz === "number") {
        // tz is shift in seconds from UTC. Calculate local date/time:
        const utcDate = new Date();
        const localDate = new Date(utcDate.getTime() + tz * 1000 + utcDate.getTimezoneOffset() * 60000);
        localTimeStr = localDate.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        localDateStr = localDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      } else {
        localTimeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        localDateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      }
    } catch (_) {
      localTimeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      localDateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    }

    const prompt = `
Generate a friendly, concise daily weather summary for ${weather.location?.city || "this area"} based on the following telemetry:
- Current Local Time: ${localTimeStr}
- Current Local Date: ${localDateStr}
- Current Temperature: ${weather.current.temp}°C (Feels like: ${weather.current.feels_like}°C)
- Current Condition: ${weather.current.description}
- Humidity: ${weather.current.humidity}%
- Wind Speed: ${weather.current.wind_speed} km/h
- UV Index: ${weather.current.uv_index !== undefined ? weather.current.uv_index : "N/A"}
- Air Quality Index (AQI): ${weather.current.aqi !== undefined ? weather.current.aqi : "N/A"}

Provide a summary in 2 to 3 sentences outlining the overall vibe. Formulate a greeting matching the current local time of day (e.g. use "Good morning" if local time is morning, "Good afternoon" if afternoon, "Good evening" if evening, or "Good night" if late night). Do not use Markdown formatting like lists or bullet points. Keep it as a clean paragraph.
`;

    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Weatherly",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are Weatherly AI, a weather assistant. Summarize weather data accurately, concisely, and cleanly.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      console.warn("[OpenRouter Error - Falling back to local weather summary]:", errorText);
      
      const temp = weather.current.temp;
      const cond = weather.current.description.toLowerCase();
      const location = weather.location?.city || "this area";
      const pop = weather.daily?.[0]?.pop ?? 0;
      
      let greeting = "Hello";
      try {
        const [timePart, ampm] = localTimeStr.split(" ");
        const hour = parseInt(timePart.split(":")[0]);
        const isPM = ampm === "PM";
        const realHour = (hour === 12 ? 0 : hour) + (isPM ? 12 : 0);
        if (realHour < 12) greeting = "Good morning";
        else if (realHour < 17) greeting = "Good afternoon";
        else if (realHour < 22) greeting = "Good evening";
        else greeting = "Good night";
      } catch (_) {}

      let advice = "";
      if (temp > 28) {
        advice = "Since it is warm, wearing light, breathable clothing and staying hydrated is highly recommended.";
      } else if (temp < 15) {
        advice = "Since it is cool, wearing a warm jacket or layers is recommended.";
      } else {
        advice = "The temperature is comfortable, so casual layered clothing is perfect.";
      }

      let rainAlert = "";
      if (pop > 50 || cond.includes("rain") || cond.includes("drizzle")) {
        rainAlert = " Bringing an umbrella or wearing a raincoat is advised due to rain chances.";
      }

      const summary = `${greeting}, ${location}! Today you can expect ${cond} conditions with a temperature of ${Math.round(temp)}°C (feels like ${Math.round(weather.current.feels_like)}°C) and a rain chance of ${pop}%. ${advice}${rainAlert}`;
      return NextResponse.json({ summary });
    }

    const result = await openRouterRes.json();
    const summary = result.choices?.[0]?.message?.content?.trim() || "No summary generated.";

    if (redis && summary) {
      // Cache for 30 minutes
      await redis.set(cacheKey, JSON.stringify(summary), { ex: 1800 });
    }

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("[AI Summary Route Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
