import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWeather } from "@/lib/weather/service";

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  weather: z.object({
    location: z.string(),
    temp: z.number(),
    condition: z.string(),
    humidity: z.number(),
    wind: z.number(),
    uv: z.number().optional(),
    rainChance: z.number().optional(),
    hourly: z.array(
      z.object({
        time: z.string(),
        temp: z.number(),
        condition: z.string(),
        pop: z.number(),
      })
    ).optional(),
    daily: z.array(
      z.object({
        day: z.string(),
        temp_min: z.number(),
        temp_max: z.number(),
        condition: z.string(),
        pop: z.number(),
      })
    ).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = chatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { messages, weather } = parsed.data;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "openrouter/free";

    if (!openRouterKey) {
      return NextResponse.json({ error: "AI service key is missing on the server" }, { status: 500 });
    }

    let activeWeather = { ...weather };
    let suggestedCity: any = null;

    // Detect if user is discussing a specific city/location in the conversation history
    // Limit detection context to the last 6 messages (3 turns) to optimize speed and avoid bad requests
    const recentMessagesForDetection = messages.slice(-6);

    if (messages.length > 0) {
      try {
        const detectRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
                content: `Analyze the conversation history. Identify the specific city, town, or location that is currently the primary subject of the weather discussion. If a location was mentioned previously and is still the active subject of the discussion, output a precise geocoding query for it (e.g. "Rangpur, Bangladesh", "London, UK"). If the discussion is about the default location "${weather.location}" or does not focus on any specific location, output "NONE". Output ONLY the clean query or "NONE". Do not add punctuation, quotes, or markdown.`,
              },
              ...recentMessagesForDetection,
            ],
          }),
        });

        if (detectRes.ok) {
          const detectData = await detectRes.json();
          const detectedLoc = detectData.choices?.[0]?.message?.content?.trim();
          if (detectedLoc && detectedLoc.toUpperCase() !== "NONE" && detectedLoc.length < 50) {
            // Geocode the location name using OpenStreetMap Nominatim
            const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(detectedLoc)}&format=json&limit=1&addressdetails=1&accept-language=en`;
            const geoRes = await fetch(geoUrl, {
              headers: { "User-Agent": "Weatherly-App/1.0 (contact@weatherly.app)" },
            });
            if (geoRes.ok) {
              const geoResults = await geoRes.json();
              if (geoResults && geoResults.length > 0) {
                const cityData = geoResults[0];
                const lat = parseFloat(cityData.lat);
                const lon = parseFloat(cityData.lon);

                // Fetch weather for this city
                const weatherData = await getWeather(lat, lon, "metric");
                const address = cityData.address || {};
                const name = address.city || address.town || address.village || address.suburb || cityData.name;

                activeWeather = {
                  location: `${name}, ${address.country || ""}`.trim().replace(/,$/, ""),
                  temp: Math.round(weatherData.current.temp),
                  condition: weatherData.current.description,
                  humidity: weatherData.current.humidity,
                  wind: Math.round(weatherData.current.wind_speed),
                  uv: weatherData.current.uv_index,
                  rainChance: weatherData.daily?.[0]?.pop ?? 0,
                  hourly: (weatherData.hourly ?? []).slice(0, 8).map((h: any) => ({
                    time: h.time,
                    temp: Math.round(h.temp),
                    condition: h.description,
                    pop: h.pop ?? 0,
                  })),
                  daily: (weatherData.daily ?? []).slice(0, 7).map((d: any) => ({
                    day: d.day_of_week,
                    temp_min: Math.round(d.temp_min),
                    temp_max: Math.round(d.temp_max),
                    condition: d.description,
                    pop: d.pop ?? 0,
                  })),
                };

                suggestedCity = {
                  display_name: cityData.display_name,
                  name,
                  lat,
                  lon,
                  city: address.city || address.town || address.village,
                  country: address.country,
                };
              }
            }
          }
        }
      } catch (err) {
        console.warn("[Chat Geocode Detect Error]:", err);
      }
    }

    const systemPrompt = `
You are Weatherly AI, a friendly and professional weather assistant.

Only answer using the weather data provided below.
Never make up or extrapolate weather information that is not explicitly in this context.
If the information is missing from the weather data, say that you don't know.
Politely refuse to answer questions that are not related to weather, climate, clothing advice, or outdoor activities.
Keep your response extremely concise, helpful, and under 3 sentences.

Current Weather:
Location: ${activeWeather.location}
Temperature: ${activeWeather.temp}°C
Condition: ${activeWeather.condition}
Humidity: ${activeWeather.humidity}%
Wind Speed: ${activeWeather.wind} km/h
UV Index: ${activeWeather.uv !== undefined ? activeWeather.uv : "N/A"}
Chance of Rain: ${activeWeather.rainChance !== undefined ? activeWeather.rainChance + "%" : "N/A"}

${activeWeather.hourly && activeWeather.hourly.length > 0 ? `
Hourly Forecast (Next 8 slots):
${activeWeather.hourly.map((h: any) => `- ${h.time}: ${h.temp}°C, ${h.condition}, Rain Chance: ${h.pop}%`).join("\n")}
` : ""}

${activeWeather.daily && activeWeather.daily.length > 0 ? `
Daily Forecast (Next 7 days):
${activeWeather.daily.map((d: any) => `- ${d.day}: Min ${d.temp_min}°C, Max ${d.temp_max}°C, ${d.condition}, Rain Chance: ${d.pop}%`).join("\n")}
` : ""}
`;

    // Limit chat response context to the last 10 messages (5 turns) to prevent token bloat
    const recentMessagesForChat = messages.slice(-10);

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
          { role: "system", content: systemPrompt },
          ...recentMessagesForChat,
        ],
      }),
    });

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      console.warn("[OpenRouter Chat Error - Falling back to local weather advisor]:", errorText);
      
      const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
      const loc = activeWeather.location;
      const temp = activeWeather.temp;
      const cond = activeWeather.condition.toLowerCase();
      const rawPop = activeWeather.rainChance ?? 0;
      const popPercent = rawPop <= 1 ? Math.round(rawPop * 100) : Math.round(rawPop);
      
      let reply = "";
      if (lastUserMsg.includes("walk") || lastUserMsg.includes("workout") || lastUserMsg.includes("run") || lastUserMsg.includes("sport") || lastUserMsg.includes("exercise") || lastUserMsg.includes("jog")) {
        if (popPercent > 40 || cond.includes("rain") || cond.includes("drizzle") || cond.includes("shower")) {
          reply = `It's currently ${cond} with a ${popPercent}% chance of rain in ${loc}. It might be better to exercise indoors or bring rain gear.`;
        } else if (temp > 32) {
          reply = `It's quite hot in ${loc} (${temp}°C). Outdoor workouts should be done with caution, plenty of hydration, and sun safety.`;
        } else {
          reply = `The weather is perfect for a walk or outdoor workout in ${loc} (${temp}°C, ${cond}).`;
        }
      } else if (lastUserMsg.includes("wear") || lastUserMsg.includes("clothe") || lastUserMsg.includes("shirt") || lastUserMsg.includes("dress") || lastUserMsg.includes("jacket") || lastUserMsg.includes("sweater") || lastUserMsg.includes("coat")) {
        if (temp > 28) {
          reply = `With a temperature of ${temp}°C in ${loc}, lightweight, breathable clothing (like cotton shirts) is your best choice.`;
        } else if (temp < 16) {
          reply = `Since it is chilly in ${loc} (${temp}°C), you should wear warm layers, a sweater, or a jacket.`;
        } else {
          reply = `At ${temp}°C, comfortable casual clothes with a light jacket or long sleeves will work perfectly in ${loc}.`;
        }
      } else if (lastUserMsg.includes("rain") || lastUserMsg.includes("umbrella") || lastUserMsg.includes("precipitation") || lastUserMsg.includes("drizzle") || lastUserMsg.includes("shower")) {
        if (popPercent > 30 || cond.includes("rain") || cond.includes("drizzle")) {
          reply = `There is a ${popPercent}% chance of rain in ${loc} today. I recommend carrying an umbrella if you head outside.`;
        } else {
          reply = `There is very little to no chance of rain today in ${loc} (${popPercent}% chance). An umbrella is not necessary.`;
        }
      } else if (lastUserMsg.includes("wind") || lastUserMsg.includes("breeze") || lastUserMsg.includes("storm") || lastUserMsg.includes("windy")) {
        reply = `The wind speed in ${loc} is currently ${activeWeather.wind} km/h under ${cond} skies.`;
      } else if (lastUserMsg.includes("humidity") || lastUserMsg.includes("humid")) {
        reply = `The current relative humidity in ${loc} is ${activeWeather.humidity}%.`;
      } else if (lastUserMsg.includes("temp") || lastUserMsg.includes("hot") || lastUserMsg.includes("cold") || lastUserMsg.includes("degree") || lastUserMsg.includes("warm") || lastUserMsg.includes("chilly")) {
        reply = `The temperature in ${loc} is ${temp}°C under ${cond} conditions.`;
      } else if (lastUserMsg.includes("forecast") || lastUserMsg.includes("hourly") || lastUserMsg.includes("tomorrow") || lastUserMsg.includes("week") || lastUserMsg.includes("days") || lastUserMsg.includes("next")) {
        if (activeWeather.daily && activeWeather.daily.length > 0) {
          const forecastLines = activeWeather.daily.slice(0, 3).map((d: any) => {
            const dPop = d.pop <= 1 ? Math.round(d.pop * 100) : Math.round(d.pop);
            return `${d.day}: ${d.temp_min}-${d.temp_max}°C, ${d.condition} (Rain: ${dPop}%)`;
          }).join("; ");
          reply = `Here is the forecast for the next 3 days in ${loc}: ${forecastLines}.`;
        } else {
          reply = `Currently in ${loc}, it is ${temp}°C and ${cond}. No extended forecast is available right now.`;
        }
      } else if (lastUserMsg.includes("hello") || lastUserMsg.includes("hi ") || lastUserMsg.includes("hi!") || lastUserMsg.includes("hey") || lastUserMsg.includes("morning") || lastUserMsg.includes("evening") || lastUserMsg.includes("afternoon")) {
        reply = `Hello! I'm Weatherly AI. Currently in ${loc}, the weather is ${cond} at ${temp}°C with ${popPercent}% chance of rain. How can I help you today?`;
      } else {
        reply = `Currently in ${loc}, the weather is ${cond} at ${temp}°C with ${popPercent}% chance of rain. Let me know if you need specific advice!`;
      }
      
      return NextResponse.json({ reply, suggestedCity });
    }

    const result = await openRouterRes.json();
    const reply = result.choices?.[0]?.message?.content?.trim() || "I'm not sure how to answer that.";

    return NextResponse.json({ reply, suggestedCity });
  } catch (error: any) {
    console.error("[AI Chat Route Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
