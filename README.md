# Weatherly

Weatherly is a Next.js weather dashboard that combines OpenWeatherMap data, OpenStreetMap geocoding, Redis caching, and optional AI-generated weather summaries and chat.

## What It Does

- Detects a visitor's approximate location on load from their IP and can also use browser geolocation when available.
- Lets users search cities through a server-side geocoding proxy backed by OpenStreetMap Nominatim.
- Displays current weather, hourly conditions, a 7-day forecast, AQI, and activity guidance.
- Renders an interactive weather map with selectable overlay layers.
- Offers an AI summary endpoint and a weather chat assistant powered by OpenRouter.
- Keeps requests server-side with Zod validation, hybrid rate limiting, Redis caching, and single-flight request coalescing.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| UI | React 19, Tailwind CSS v4, lucide-react, Recharts |
| Data | TanStack Query, Zod |
| Weather data | OpenWeatherMap |
| Geocoding | OpenStreetMap Nominatim |
| AI | OpenRouter |
| Cache and rate limiting | Upstash Redis and Upstash Ratelimit |
| Tests | Vitest |

## Main Routes

- `/` - weather dashboard
- `/dashboard` - redirects to `/`
- `/api/weather/auto` - auto-detect weather by client IP
- `/api/weather/current` - weather by latitude and longitude
- `/api/weather/hourly` - hourly forecast data
- `/api/weather/ai/summary` - AI-generated summary for a location
- `/api/weather/ai/chat` - weather chat assistant
- `/api/geocode` - city search and reverse geocoding proxy
- `/api/weather/map/[layer]/[z]/[x]/[y]` - weather map tiles for overlay layers

## Local Development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Other available scripts:

- `npm run build` - production build
- `npm run start` - start the production server
- `npm run lint` - run ESLint

## Environment Variables

The app expects server-side API keys and cache credentials to be available in the environment. The main values used by the codebase are:

- `OPENWEATHER_API_KEY` - used by the weather service layer
- `OPENROUTER_API_KEY` - used by the AI summary and chat routes
- `OPENROUTER_MODEL` - optional OpenRouter model override
- Redis / Upstash environment variables used by `src/lib/cache/redis.ts` and the rate-limit layer

## Testing

Vitest covers utility helpers and route handlers under `tests/unit` and `tests/integration`.

```bash
npm test
```

If you want, I can also add a short architecture diagram or a setup section for the required environment variables.
