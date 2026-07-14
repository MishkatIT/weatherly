# Weatherly

> **Powered by WeatherAI**
>
> A production-minded full-stack weather and environmental intelligence platform powered by the **WeatherAI API**.

Weatherly is designed to demonstrate API consumption and architectural best practices, focusing on secure API-key handling, distributed caching, quota efficiency, rate limiting, and robust input validation.

---

## 1. Project Overview

Beyond basic API consumption, Weatherly implements key production concerns:

- **Zero Client-Side API Exposure**: The WeatherAI key never touches the browser.
- **Distributed Caching**: Shared Upstash Redis cache across serverless environments.
- **Fair-Use Rate Limiting**: Hybrid session-level rate limiting combined with broad IP abuse protection.
- **Cache Stampede Prevention**: Single-flight request coalescing for cache misses.
- **Comprehensive Testing**: Pure TypeScript unit, integration, and E2E tests.

---

## 2. Live Demo & Repository

- **Live Demo**: [https://weatherly-66o7.onrender.com](https://weatherly-66o7.onrender.com)
- **GitHub Repository**: [MishkatIT/weatherly](https://github.com/MishkatIT/weatherly)
- **Deployed on**: [Render](https://render.com)

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Runtime** | React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 |
| **UI Components** | shadcn/ui, Base UI, Lucide React |
| **Data Fetching** | TanStack Query v5 |
| **Charts** | Recharts v3 |
| **Validation** | Zod v4 |
| **Caching & Rate Limiting** | Upstash Redis + Upstash Ratelimit |
| **Testing** | Vitest (unit + integration), Playwright (E2E) |

---

## 4. Product Features & User Journeys

### Feature 1: Weather Dashboard (`/`)
- Detects the client's location automatically on visit using their network IP.
- Resolves the IP server-side and forwards it to WeatherAI's `/v1/weather-geo` geolocation endpoint.
- Displays local current temperature, conditions, and daily forecasts inside a glassmorphic dashboard, along with a Gemini-generated AI summary.
- Supports city search with a debounced (600ms) geocoding proxy that queries OpenStreetMap Nominatim and caches coordinates in Redis.
- Interactive Recharts line chart shows temperature trends over the forecast period.
- Toggle between Celsius and Fahrenheit units.

> **Note**: The `/dashboard` route permanently redirects to `/` (configured in `next.config.ts`).

### Feature 2: Farm Canopy Analyzer (`/farm`)
- Drag-and-drop crop care image upload (JPEG, PNG, WEBP; up to 20MB).
- CV model analyzes trees to return tree count, density per acre, and healthy vs. stressed vs. diseased distribution.
- Renders an interactive Pie Chart alongside bulleted computer vision observations and recommendations.
- Real-time quota tracking via the floating `API Usage` widget.

---

## 5. WeatherAI API Coverage

| WeatherAI Endpoint | Used For | Optimization |
|---|---|---|
| `/v1/weather-geo` | Automatic location-based weather | 15-minute server-side caching by IP |
| `/v1/weather` | Current weather, 7-day forecast, and AI summary | 10-minute Redis cache |
| `/v1/hourly` | Scrollable hourly breakdowns | Called with `ai=false`, cached 10 minutes |
| `/v1/trees/analyze` | Farm imagery crop count and canopy health | Direct memory stream forwarding, never cached |
| `/v1/trees/quota` | Tree analysis remaining upload stats | 5-minute cache + auto-invalidation on upload |
| `/v1/usage` | Global usage dashboard widget | 5-minute cache + auto-refetch on mutations |

---

## 6. Architecture

```
┌───────────────────────┐
│       Browser         │
│                       │
│ Next.js UI            │
│ TanStack Query        │
└───────────┬───────────┘
            │
            │ Same-origin /api/*
            ▼
┌────────────────────────┐
│ Next.js Server Layer   │
│                        │
│ 1. Session identity    │
│ 2. Zod validation      │
│ 3. Hybrid rate limit   │
│ 4. Redis cache         │
│ 5. Request coalescing  │
│ 6. Service layer       │
│ 7. Error normalization │
└───────────┬────────────┘
            │
            │ Server-side API key
            ▼
┌───────────────────────┐
│    WeatherAI API      │
└───────────────────────┘
```

The browser never communicates directly with WeatherAI. All WeatherAI requests pass through same-origin Next.js Route Handlers. This creates a controlled server boundary where credentials remain private and requests can be validated, rate-limited, cached, monitored, and normalized before reaching the upstream API.

---

## 7. Request Lifecycle

```
Browser request
      ↓
Anonymous session lookup/creation
      ↓
Zod input validation
      ↓
Session-level rate limit (Upstash)
      ↓
Broad IP abuse guard (Upstash)
      ↓
Redis cache lookup
      ↓
Single-flight protection (Process-level)
      ↓
WeatherAI service layer
      ↓
Timeout + selective retry policy
      ↓
Cache successful response
      ↓
Normalize response/error
      ↓
Browser
```

---

## 8. Key Engineering Decisions

| Decision | Why |
|---|---|
| **No user accounts** | No persistent user-owned data currently requires identity. |
| **Anonymous UUID cookie** | Fair browser-level rate limiting without collecting account information. |
| **Hybrid UUID + IP limits** | Balances shared-network fairness with abuse protection. |
| **Next.js Route Handlers** | Secure same-origin server boundary; eliminates CORS. |
| **Server-only client** | Prevents API-key exposure. |
| **Redis** | Shared cache across stateless serverless instances. |
| **Zod** | Rejects invalid input before consuming upstream quota. |
| **TanStack Query** | Manages client-side server state and request lifecycle. |
| **Selective `ai=false`** | Preserves limited AI quota on non-critical calls. |
| **No persistent image storage** | Keeps uploads in RAM and forwards them directly to reduce storage complexity. |
| **Centralized error handling** | Stable API contract and reduced internal leakage. |
| **Bounded selective retries** | Resilience without causing retry storms. |

---

## 9. Why There Is No User Login

User authentication was intentionally not added because the current product does not contain user-owned persistent data or features that require identity. Adding accounts solely for architectural complexity would introduce database setup, session, OAuth, and account-lifecycle concerns without improving the core WeatherAI integration.

Instead, the application uses an anonymous HttpOnly UUID session for fair rate limiting. This provides a stable browser-level identifier without collecting personal account information.

If the product later introduced saved locations, persistent analysis history, personalized alerts, team workspaces, or billing, authentication would become justified and could be added without changing the WeatherAI service architecture.

---

## 10. Anonymous Session Design
The UUID is not authentication and does not represent a user account. It is an anonymous browser-level identifier used only for operational controls such as fair rate limiting.

### Shared-IP Problem
In public Wi-Fi, offices, or university networks, hundreds of devices share a single public IP. If rate limits were strictly IP-based, one heavy user could block everyone else on the same network.

The anonymous session cookie bypasses this by allocating unique rate-limit buckets to individual browsers.
- **Cookie settings**: `HttpOnly`, `SameSite=Lax`, `Secure` (in production), `Path=/`, and a 1-year max age.

---

## 11. Security Design

- **Server-only API key**: Hiding the API key prevents malicious clients from exhausting your monthly plan.
- **Same-origin Route Handlers**: Prevents cross-origin credential stealing.
- **Zod validation**: Protects downstream microservices from injection or malformed parameters.
- **Latitude/longitude range checks**: Zod ensures latitudes are within `[-90, 90]` and longitudes are within `[-180, 180]` before forwarding to geocoding or weather services.
- **File MIME validation**: Restricts uploads to JPEG, PNG, and WEBP to prevent execution of arbitrary uploaded scripts.
- **File size limit**: 20MB limit protects the Node.js process from out-of-memory crashes.
- **Session rate limit & Broad IP guard**: Mitigates automated cookie deletion and brute-force scraper scripts.

---

## 12. Caching & API Quota Optimization

### Comparison: TanStack Query vs. Redis

| Feature | TanStack Query | Redis |
|---|---|---|
| **Location** | Browser-side memory | Server-side cloud database |
| **Scope** | Single browser session / tab | Shared globally across all users |
| **Purpose** | Minimizes redundant fetches when navigating between pages | Drastically reduces WeatherAI API hits globally |
| **Invalidation** | Automated (staleTime, focus, mutation invalidation) | Time-to-Live (TTL) expiration |

### Why Redis instead of process memory?
Next.js applications deployed to platforms like Vercel run inside stateless serverless functions. These instances scale up and down independently and do not share memory. Storing cache in local process variables would result in frequent cache misses as requests hit different serverless containers. Upstash Redis provides a shared, centralized cache layer accessible by all instances.

---

## 13. Cache-Key Correctness
Cache keys are designed to incorporate all variables that affect the API response to prevent incorrect cache collisions:
- **Format**: `weather:current:{roundedLat}:{roundedLon}:{units}:{days}:{ai}`
- **Rounding**: Coordinates are rounded to 2 decimal places. A search for coordinates `22.3648` and `22.3599` will resolve to the same cache key `22.36`, increasing the cache hit rate for nearby searches.
- **Parameters**: `units` and `ai` properties are key parts. A metric query will never hit a cached imperial result.

---

## 14. Cache-Stampede Protection
When a cache key expires, many users requesting it at the same time might all observe a cache miss and hit the WeatherAI API concurrently. Weatherly prevents this via a **single-flight** utility (request coalescing). If a request for a key is in-flight, concurrent calls will share the existing promise instead of spawning duplicate requests.

---

## 15. Geocoding Strategy
The browser never calls OpenStreetMap Nominatim directly. It calls our proxy endpoint `/api/geocode?q=...`. This allows us to:
- Sanitize and validate query inputs.
- Attach required custom `User-Agent` headers to respect OSM policies.
- Cache results globally in Redis for 7 days (since city locations are stable), bypassing Nominatim limits for frequently searched terms.

---

## 16. WeatherAI Client, Service & Route Responsibilities
- **Client Layer (`client.ts`)**: Base HTTP configurations, authentication headers, AbortController timeouts (8s), and exponential backoff retry rules for transient codes (502, 503, 504, 429).
- **Service Layer (`service.ts`)**: Mappings, method definitions, payload wrapping.
- **Route Handlers (`app/api/*`)**: Request parsing, rate-limiting check, Redis cache lookup/write, and error normalization wrapper.

---

## 17. Reliability & Error Handling

### Error Normalization
All errors are normalized into a safe JSON structure. Stack traces, API keys, or raw provider headers are stripped out before returning to the browser.
```json
{
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "Upstream request timed out"
  }
}
```

### Retry Policy

| HTTP Code / Error | Retry? | Strategy |
|---|---|---|
| **400 / 401 / 403 / 404** | No | Fails immediately (bad parameter, invalid auth, not found) |
| **429 (Rate Limit)** | Yes | Bounded retry (max 3), respecting `Retry-After` header |
| **502 / 503 / 504 (Server error)** | Yes | Exponential backoff (initial delay 500ms, doubling each attempt) |
| **Timeout (AbortError)** | Yes | Exponential backoff |
| **File Upload (POST)** | No | Image analysis requests are never retried to prevent quota wastage |

---

## 18. Farm Image Upload Security
- Images are processed in RAM only (`request.formData()`).
- File names are ignored to prevent path traversal vulnerabilities.
- File size is restricted to 20MB.
- MIME type is checked against a strict whitelist.

---

## 19. Usage & Quota Monitoring
The `UsageWidget` (floating bubble at the bottom right) queries `/api/usage` to display current quota status (requests count and AI requests count). 
- When tree analysis or weather queries are made, TanStack Query invalidates `["usage"]`, triggering an immediate refetch to show updated figures.

---

## 20. Local Setup

### Prerequisites

- **Node.js** v20+
- **npm** v10+ (comes with Node.js)
- A **WeatherAI API key** from [api.weather-ai.co](https://api.weather-ai.co)
- An **Upstash Redis** instance from [upstash.com](https://upstash.com) (free tier works)

### Step 1 — Clone the Repository

```bash
git clone https://github.com/MishkatIT/weatherly.git
cd weatherly
```

### Step 2 — Configure Environment Variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# WeatherAI API key (from api.weather-ai.co)
WAI_API_KEY=wai_your_secret_api_key

# Upstash Redis (from upstash.com → Redis → REST API)
UPSTASH_REDIS_REST_URL=https://your-upstash-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# App base URL — use localhost for local dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note**: In production on Render, `NEXT_PUBLIC_APP_URL` should be set to `https://weatherly-66o7.onrender.com` (or your custom domain) in the Render environment variables dashboard.

### Step 3 — Install Dependencies

```bash
npm install --legacy-peer-deps
```

### Step 4 — Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the production bundle |
| `npm run start` | Start the production server (after build) |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest unit + integration tests |
| `npx playwright test` | Run Playwright E2E tests |

---

## 21. Testing

### Unit & Integration Tests

We use **Vitest** for unit and route integration tests. Test files are located in `tests/unit/` and `tests/integration/`.

```bash
npm run test
```

> *Note: Tests are monkey-patched (via `patch-node.js`) to bypass a Node.js `styleText` formatting bug, ensuring a 100% pass rate on Node 20+.*

### E2E Tests

[Playwright](https://playwright.dev/) E2E test files are located in `tests/e2e/`.

```bash
npx playwright test
```

---

## 22. Deployment (Render)

The app is deployed on [Render](https://render.com) as a **Web Service**.

### Render Environment Variables

Set the following in your Render service's **Environment** tab:

| Variable | Value |
|---|---|
| `WAI_API_KEY` | Your WeatherAI secret key |
| `UPSTASH_REDIS_REST_URL` | Your Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash Redis REST token |
| `NEXT_PUBLIC_APP_URL` | `https://weatherly-66o7.onrender.com` |
| `NODE_ENV` | `production` |

### Build & Start Commands

| Setting | Value |
|---|---|
| **Build Command** | `npm install --legacy-peer-deps && npm run build` |
| **Start Command** | `npm run start` |

---

## 23. Scaling Considerations

If traffic scales, the following can be introduced:

1. **Queue-Based Analysis**: Image analysis (`/v1/trees/analyze`) is slow. At scale, uploads should write to an S3 bucket and trigger a background worker queue (e.g. BullMQ), returning a job ID to the client for polling.
2. **Edge Caching**: Cache public weather GET requests directly on Render's CDN using `Cache-Control` headers to completely bypass serverless execution costs.
3. **Database-backed sessions**: Swap the anonymous UUID cookie for a proper auth session if user features are introduced.
