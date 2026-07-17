"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  Loader2,
  AlertCircle,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Calendar,
  CloudRain,
  CloudLightning,
  CloudSnow,
  Cloud,
  ChevronRight,
  TrendingUp,
  Gauge,
  Eye,
  Navigation,
  Sunrise,
  Sunset,
  Leaf,
  Zap,
  Umbrella,
  Triangle,
  RefreshCw,
  Compass,
  Droplet,
  Sparkles,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { WeatherResponse } from "@/lib/weather-ai/types";
import { GeocodeResult } from "@/app/api/geocode/route";
import { cn } from "@/lib/utils";
import WeatherMap from "@/components/shared/WeatherMap";
import ActivityAdvisor from "@/components/shared/ActivityAdvisor";

// ─── Weather gradient ────────────────────────────────────────────────────────
function getWeatherGradient(description = "") {
  const d = description.toLowerCase();
  if (d.includes("clear") || d.includes("sunny"))
    return "from-amber-500/20 via-orange-400/10 to-sky-100/30 border-amber-500/20 dark:from-amber-950/30 dark:via-orange-950/15 dark:border-amber-950/40";
  if (d.includes("rain") || d.includes("drizzle") || d.includes("shower"))
    return "from-blue-500/20 via-indigo-500/10 border-blue-500/20 dark:from-indigo-950/35 dark:via-slate-900/40 dark:border-indigo-950/40";
  if (d.includes("thunder") || d.includes("storm"))
    return "from-purple-500/20 via-violet-600/10 border-purple-500/20 dark:from-purple-950/35 dark:border-purple-950/40";
  if (d.includes("snow") || d.includes("ice"))
    return "from-cyan-300/25 via-sky-300/10 border-cyan-400/20 dark:from-cyan-950/30 dark:border-cyan-950/40";
  return "from-slate-300/20 via-zinc-400/10 border-slate-300/40 dark:from-slate-800/40 dark:border-slate-800/60";
}

// ─── Weather icon ────────────────────────────────────────────────────────────
function getWeatherIcon(iconName = "", className = "h-6 w-6") {
  const icon = iconName.toLowerCase();
  if (icon === "sun")
    return <Sun className={cn("text-amber-400", className)} />;
  if (icon === "rain")
    return <CloudRain className={cn("text-blue-500 dark:text-blue-400", className)} />;
  if (icon === "thunder")
    return <CloudLightning className={cn("text-purple-500 dark:text-purple-400", className)} />;
  if (icon === "snow")
    return <CloudSnow className={cn("text-sky-400 dark:text-sky-300", className)} />;
  return <Cloud className={cn("text-slate-400", className)} />;
}

// ─── AQI helpers ─────────────────────────────────────────────────────────────
function aqiColor(aqi: number) {
  const map: Record<number, string> = {
    1: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50",
    2: "text-lime-600 dark:text-lime-400 bg-lime-50 dark:bg-lime-950/40 border-lime-200 dark:border-lime-800/50",
    3: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50",
    4: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/50",
    5: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50",
  };
  return map[aqi] ?? "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/50";
}

function aqiLabel(aqi: number) {
  const map: Record<number, string> = { 1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor" };
  return map[aqi] ?? "—";
}

// ─── Wind / Sun helpers ──────────────────────────────────────────────────────
function windDegToCardinal(deg?: number) {
  if (deg === undefined) return "—";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function formatSunTime(unix?: number) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// ─── UV risk label ───────────────────────────────────────────────────────────
function uvLabel(uvi?: number): { text: string; color: string } {
  if (uvi === undefined) return { text: "—", color: "text-slate-500" };
  if (uvi <= 2) return { text: "Low", color: "text-emerald-500 dark:text-emerald-400" };
  if (uvi <= 5) return { text: "Moderate", color: "text-amber-500 dark:text-amber-400" };
  if (uvi <= 7) return { text: "High", color: "text-orange-500 dark:text-orange-400" };
  if (uvi <= 10) return { text: "Very High", color: "text-red-500 dark:text-red-400" };
  return { text: "Extreme", color: "text-purple-600 dark:text-purple-400" };
}

// ─── Metric tile ─────────────────────────────────────────────────────────────
function MetricTile({
  icon,
  label,
  value,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex items-center gap-3 group/metric cursor-help" title={title}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900/60 shadow-sm border border-slate-200/50 dark:border-0">
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase font-semibold tracking-wide">{label}</span>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{value}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<GeocodeResult | null>(null);
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [isDark, setIsDark] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Unit helpers (API always returns metric; convert client-side) ──────────
  const fmtTemp = (c: number) =>
    units === "imperial" ? Math.round((c * 9) / 5 + 32) : Math.round(c);
  const fmtWind = (kmh: number) =>
    units === "imperial" ? Math.round(kmh * 0.621371) : Math.round(kmh);
  const windUnit = units === "metric" ? "km/h" : "mph";
  const tempUnit = units === "metric" ? "°C" : "°F";

  // ── Persist unit preference ───────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("weatherly:units");
    if (saved === "metric" || saved === "imperial") setUnits(saved);
  }, []);

  const handleToggleUnits = (u: "metric" | "imperial") => {
    setUnits(u);
    localStorage.setItem("weatherly:units", u);
  };

  // ── Dark mode observer ────────────────────────────────────────────────────
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Weather query (One Call 4.0 via /api/weather/current) ────────────────
  const {
    data: weather,
    isLoading: isWeatherLoading,
    isError: isWeatherError,
    error: weatherError,
    refetch: refetchWeather,
  } = useQuery<WeatherResponse>({
    queryKey: ["weather", selectedCity?.lat, selectedCity?.lon],
    queryFn: async () => {
      if (!selectedCity) return null as any;
      const res = await fetch(
        `/api/weather/current?lat=${selectedCity.lat}&lon=${selectedCity.lon}&units=metric`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Failed to load weather data");
      }
      return res.json();
    },
    enabled: !!selectedCity,
    staleTime: 1000 * 60 * 10,
  });

  // ── Geocoding query ───────────────────────────────────────────────────────
  const { data: geocodeResults, isLoading: isGeocoding } = useQuery<GeocodeResult[]>({
    queryKey: ["geocode", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim()) return [];
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(debouncedSearch)}`);
      if (!res.ok) throw new Error("Geocoding failed");
      return res.json();
    },
    enabled: debouncedSearch.trim().length > 1,
  });

  // ── Detect location ───────────────────────────────────────────────────────
  const detectLocation = async (usePrecise = false) => {
    setIsDetecting(true);
    const saveAndSet = (loc: GeocodeResult) => {
      setSelectedCity(loc);
      localStorage.setItem("weatherly:last_searched_city", JSON.stringify(loc));
      setIsDetecting(false);
    };

    if (usePrecise && typeof window !== "undefined" && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        const { latitude: lat, longitude: lon } = pos.coords;
        const geoRes = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
        if (geoRes.ok) {
          const results = await geoRes.json();
          const r = Array.isArray(results) ? results[0] : results;
          if (r?.lat !== undefined) {
            saveAndSet({ display_name: r.display_name, name: r.name || "Local", lat: +r.lat, lon: +r.lon, city: r.city, country: r.country });
            return;
          }
        }
      } catch { /* fall through */ }
    }

    try {
      const res = await fetch("/api/weather/auto");
      if (res.ok) {
        const data = await res.json();
        if (data?.location) {
          saveAndSet({
            display_name: `${data.location.city}, ${data.location.country}`,
            name: data.location.city,
            lat: data.location.lat,
            lon: data.location.lon,
            city: data.location.city,
            country: data.location.country,
          });
          return;
        }
      }
    } catch { /* fall through */ }

    saveAndSet({ display_name: "New York City, United States", name: "New York", lat: 40.7128, lon: -74.006, city: "New York City", country: "United States" });
  };

  // ── Sync active city changes to AI summary and chatbot ──────────────────────
  const fetchAiSummary = async (lat: number, lon: number, force: boolean = false) => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/weather/ai/summary?lat=${lat}&lon=${lon}${force ? "&force=true" : ""}`);
      if (!res.ok) {
        setAiError("Failed to generate AI weather summary.");
        setIsAiLoading(false);
        return;
      }
      const data = await res.json();
      setAiSummary(data.summary);
    } catch (err) {
      console.error(err);
      setAiError("Failed to generate AI weather summary.");
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCity?.lat !== undefined) {
      fetchAiSummary(selectedCity.lat, selectedCity.lon);
      window.dispatchEvent(new CustomEvent("weatherly:city_changed"));
    }
  }, [selectedCity?.lat, selectedCity?.lon]);

  // ── Mount: load saved city or detect ─────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("weatherly:last_searched_city");
    if (saved) {
      try { setSelectedCity(JSON.parse(saved)); return; } catch { /* ignore */ }
    }
    detectLocation();
  }, []);

  // ── Debounce search ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 600);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const handleSelectCity = (city: GeocodeResult) => {
    setSelectedCity(city);
    localStorage.setItem("weatherly:last_searched_city", JSON.stringify(city));
    setSearchTerm("");
    setDebouncedSearch("");
    setShowDropdown(false);
  };

  // ── Listen to location switch request from AI Chat ─────────────────────────
  useEffect(() => {
    const handleSelectCityEvent = (e: Event) => {
      const customEvent = e as CustomEvent<GeocodeResult>;
      if (customEvent.detail) {
        handleSelectCity(customEvent.detail);
      }
    };
    window.addEventListener("weatherly:select_city", handleSelectCityEvent);
    return () => window.removeEventListener("weatherly:select_city", handleSelectCityEvent);
  }, []);

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = weather?.daily?.slice(0, 8).map((d) => ({
    name: d.day_of_week.slice(0, 3),
    Max: fmtTemp(d.temp_max),
    Min: fmtTemp(d.temp_min),
    ...(d.pop !== undefined ? { Rain: d.pop } : {}),
  })) ?? [];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Weather Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Powered by OpenWeather One Call API 4.0 — real-time conditions, 48h hourly, 8-day daily & alerts.
          </p>
        </div>

        {/* Unit switcher */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
          <div className="flex items-center bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-0.5 rounded-xl shadow-sm">
            {(["metric", "imperial"] as const).map((u) => (
              <button
                key={u}
                onClick={() => handleToggleUnits(u)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200",
                  units === u
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                    : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                {u === "metric" ? "Celsius (°C)" : "Fahrenheit (°F)"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <div className="flex gap-3 max-w-xl">
        <div className="relative flex-1" ref={searchRef}>
          <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-sky-500/50 focus-within:ring-2 focus-within:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-900/50 dark:focus-within:border-sky-500/50 transition-all shadow-sm">
            <Search className="h-5 w-5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search city — London, Dhaka, Tokyo…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              className="w-full bg-transparent border-0 px-3 py-0 text-slate-900 placeholder-slate-400 dark:text-white dark:placeholder-slate-500 focus:outline-none focus:ring-0 sm:text-sm"
            />
            {isGeocoding && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
          </div>

          {showDropdown && geocodeResults && geocodeResults.length > 0 && (
            <div className="absolute top-full left-0 z-50 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
              <ul className="space-y-0.5">
                {geocodeResults.map((result, idx) => (
                  <li key={idx}>
                    <button
                      onClick={() => handleSelectCity(result)}
                      className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 dark:text-white">{result.name}</span>
                        <span className="text-xs text-slate-500 mt-0.5 line-clamp-1">{result.display_name}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          onClick={() => detectLocation(true)}
          disabled={isDetecting}
          title="Use precise location"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 active:scale-95 disabled:opacity-50 transition-all shadow-sm"
        >
          <MapPin className={cn("h-5 w-5 text-sky-500 dark:text-sky-400", isDetecting && "animate-bounce")} />
        </button>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!selectedCity && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 px-6 text-center dark:border-slate-800 dark:bg-slate-950/20">
          <MapPin className="h-10 w-10 text-slate-400 mb-3" />
          <h3 className="text-md font-bold text-slate-900 dark:text-white">No city selected</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">Detecting your location — or search above.</p>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {isWeatherLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
          <span className="text-xs text-slate-500 mt-3 font-semibold">Fetching weather data…</span>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {isWeatherError && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/5 py-12 px-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Data Unavailable</h3>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400 mt-2">
            {weatherError instanceof Error ? weatherError.message : "Unable to retrieve weather data."}
          </p>
          <button
            onClick={() => refetchWeather()}
            className="mt-4 flex items-center gap-2 text-xs font-semibold text-sky-500 hover:text-sky-400 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      {/* ── Dashboard ───────────────────────────────────────────────────────── */}
      {weather && selectedCity && (
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ════ Main weather card (2-col) ═══════════════════════════════════ */}
          <div
            className={cn(
              "lg:col-span-2 relative overflow-hidden rounded-3xl border p-6 sm:p-8 flex flex-col bg-gradient-to-b shadow-xl backdrop-blur-sm bg-white/70 dark:bg-slate-900/40",
              getWeatherGradient(weather.current.description)
            )}
          >
            {/* Location header */}
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <MapPin className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                  <span className="text-xs font-bold tracking-widest uppercase">Current Conditions</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {selectedCity.name}
                  {selectedCity.country && (
                    <span className="text-slate-400 dark:text-slate-400 font-semibold text-xl sm:text-2xl">
                      , {selectedCity.country}
                    </span>
                  )}
                </h2>
                <span className="inline-block text-[10px] bg-slate-100 dark:bg-slate-900/80 px-2 py-0.5 rounded-md text-slate-500 dark:text-slate-500 font-mono">
                  {selectedCity.lat.toFixed(3)}°, {selectedCity.lon.toFixed(3)}°
                </span>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="p-3 bg-white/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 shadow-sm backdrop-blur-md">
                  {getWeatherIcon(weather.current.icon, "h-12 w-12")}
                </div>
                {weather.current.aqi !== undefined && (
                  <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold", aqiColor(weather.current.aqi))}>
                    <Leaf className="h-3.5 w-3.5" />
                    AQI: {aqiLabel(weather.current.aqi)}
                  </div>
                )}
              </div>
            </div>

            {/* Temperature */}
            <div className="my-5 flex items-baseline gap-3">
              <span className="text-7xl sm:text-8xl font-black tracking-tighter text-slate-900 dark:text-white">
                {fmtTemp(weather.current.temp)}{tempUnit}
              </span>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white capitalize">
                  {weather.current.description}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Feels like{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {fmtTemp(weather.current.feels_like)}{tempUnit}
                  </span>
                </p>
              </div>
            </div>

            {/* Sunrise / Sunset */}
            {(weather.current.sunrise || weather.current.sunset) && (
              <div className="flex items-center gap-6 mb-5">
                <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 cursor-help" title="Sunrise local time">
                  <Sunrise className="h-4 w-4" />
                  <span className="text-xs font-semibold">{formatSunTime(weather.current.sunrise)}</span>
                </div>
                <div className="flex items-center gap-2 text-orange-500 dark:text-orange-400 cursor-help" title="Sunset local time">
                  <Sunset className="h-4 w-4" />
                  <span className="text-xs font-semibold">{formatSunTime(weather.current.sunset)}</span>
                </div>
              </div>
            )}

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-200/60 dark:border-slate-800/40 pt-6">
              <MetricTile icon={<Droplets className="h-4 w-4 text-sky-500 dark:text-sky-400" />} label="Humidity" value={`${weather.current.humidity}%`} title="Relative humidity (percentage of water vapor in the air)" />
              <MetricTile
                icon={<Wind className="h-4 w-4 text-sky-500 dark:text-sky-400" />}
                label="Wind"
                value={`${fmtWind(weather.current.wind_speed)} ${windUnit} ${windDegToCardinal(weather.current.wind_deg)}`}
                title="Current wind speed and cardinal blowing direction"
              />
              <MetricTile icon={<Gauge className="h-4 w-4 text-sky-500 dark:text-sky-400" />} label="Pressure" value={weather.current.pressure !== undefined ? `${weather.current.pressure} hPa` : "—"} title="Atmospheric pressure at sea level in hectopascals (hPa)" />
              <MetricTile icon={<Eye className="h-4 w-4 text-sky-500 dark:text-sky-400" />} label="Visibility" value={weather.current.visibility !== undefined ? `${weather.current.visibility} km` : "—"} title="Maximum visible distance range in kilometers (km)" />
              <MetricTile icon={<Cloud className="h-4 w-4 text-sky-500 dark:text-sky-400" />} label="Cloud Cover" value={weather.current.clouds !== undefined ? `${weather.current.clouds}%` : "—"} title="Percentage of the sky covered by clouds" />
              <MetricTile
                icon={<Navigation className="h-4 w-4 text-sky-500 dark:text-sky-400" style={{ transform: weather.current.wind_deg !== undefined ? `rotate(${weather.current.wind_deg}deg)` : undefined }} />}
                label="Wind Dir"
                value={weather.current.wind_deg !== undefined ? `${windDegToCardinal(weather.current.wind_deg)} (${weather.current.wind_deg}°)` : "—"}
                title="Wind direction angle relative to true North"
              />
              <MetricTile
                icon={<Sun className="h-4 w-4 text-amber-500" />}
                label="UV Index"
                value={
                  weather.current.uv_index !== undefined ? (
                    <span className={uvLabel(weather.current.uv_index).color}>
                      {weather.current.uv_index.toFixed(1)} — {uvLabel(weather.current.uv_index).text}
                    </span>
                  ) : "—"
                }
                title="Ultraviolet radiation intensity index (risk level scale)"
              />
              <MetricTile
                icon={<Droplet className="h-4 w-4 text-sky-500 dark:text-sky-400" />}
                label="Dew Point"
                value={weather.current.dew_point !== undefined ? `${fmtTemp(weather.current.dew_point)}${tempUnit}` : "—"}
                title="The dew point temperature at which air condenses into moisture droplets"
              />
            </div>
          </div>

          {/* ════ AI Summary Card ══════════════════════════════════════════════ */}
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 p-6 sm:p-8 shadow-xl dark:border-slate-800/40 dark:bg-slate-950/20 relative overflow-hidden flex flex-col justify-between h-full min-h-[350px] lg:min-h-0">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Sparkles className="h-16 w-16 text-sky-500" />
            </div>

            <div>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5 text-sky-500 animate-pulse" />
                  AI Overview
                </h3>
                {aiSummary && !isAiLoading && (
                  <button
                    type="button"
                    onClick={() => selectedCity && fetchAiSummary(selectedCity.lat, selectedCity.lon, true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 hover:bg-sky-100 dark:text-sky-400 dark:bg-sky-950/40 border border-sky-200/50 dark:border-sky-850/40 active:scale-95 transition-all cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </button>
                )}
              </div>

              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
                  <span className="text-xs text-slate-500 mt-2 font-medium">Weatherly AI is thinking...</span>
                </div>
              ) : aiError ? (
                <p className="text-xs text-red-500 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  {aiError}
                </p>
              ) : (
                <p className="text-sm sm:text-[15px] leading-relaxed font-medium text-slate-700 dark:text-slate-200 pr-2">
                  {aiSummary || "Select a city to generate an AI summary."}
                </p>
              )}
            </div>

            <span className="text-[10px] text-slate-400 text-right mt-6 border-t border-slate-100/50 dark:border-slate-900/50 pt-3">
              Weatherly AI Summary
            </span>
          </div>

          {/* ════ Hourly Forecast (Horizontal Row) ════════════════════════════ */}
          <div className="lg:col-span-3 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800/40 dark:bg-slate-950/20">
            <h3 className="text-md font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Compass className="h-4.5 w-4.5 text-sky-500" />
              Hourly Forecast (24h)
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin w-full justify-between lg:overflow-x-visible">
              {(weather.hourly ?? []).slice(0, 24).map((hour, idx) => (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center justify-between min-w-[85px] max-w-[160px] rounded-2xl bg-slate-50 border border-slate-100 p-3.5 hover:bg-slate-100/60 dark:bg-slate-900/40 dark:border-slate-900/60 dark:hover:bg-slate-900/80 transition-colors shrink-0 lg:shrink lg:min-w-0"
                >
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">{hour.time}</span>
                  <div className="my-2.5">
                    {getWeatherIcon(hour.icon, "h-7 w-7")}
                  </div>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{fmtTemp(hour.temp)}{tempUnit}</span>
                  {hour.pop !== undefined && hour.pop > 0 ? (
                    <span className="text-[9px] text-blue-500 dark:text-blue-400 font-bold flex items-center gap-0.5 mt-1.5">
                      <Umbrella className="h-3 w-3" />{hour.pop}%
                    </span>
                  ) : (
                    <span className="h-4 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ════ AQI card ═════════════════════════════════════════════════════ */}
          {weather.current.aqi !== undefined && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800/40 dark:bg-slate-950/20 flex flex-col">
              <h3 className="text-md font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Leaf className="h-4 w-4 text-emerald-500" />
                Air Quality Index
              </h3>
              <div className={cn("rounded-2xl border p-6 text-center mb-4", aqiColor(weather.current.aqi))}>
                <span className="text-5xl font-black">{weather.current.aqi}</span>
                <p className="text-lg font-bold mt-1">{aqiLabel(weather.current.aqi)}</p>
              </div>
              <div className="space-y-2 text-xs">
                {([
                  { n: 1, label: "Good",      color: "bg-emerald-500" },
                  { n: 2, label: "Fair",      color: "bg-lime-500" },
                  { n: 3, label: "Moderate",  color: "bg-amber-500" },
                  { n: 4, label: "Poor",      color: "bg-orange-500" },
                  { n: 5, label: "Very Poor", color: "bg-red-500" },
                ] as const).map((item) => (
                  <div key={item.n} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <div className={cn("h-2 w-2 rounded-full shrink-0", item.color)} />
                    <span className={weather.current.aqi === item.n ? "font-bold text-slate-900 dark:text-white" : ""}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 text-right mt-auto pt-4 border-t border-slate-100 dark:border-slate-900">
                OpenWeather Air Pollution API
              </span>
            </div>
          )}

          {/* ════ Temperature trend chart ══════════════════════════════════════ */}
          <div className={cn(
            "rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800/40 dark:bg-slate-950/20",
            weather.current.aqi !== undefined ? "lg:col-span-2" : "lg:col-span-3"
          )}>
            <h3 className="text-md font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-500 dark:text-sky-400" />
              {weather.daily?.length || 8}-Day Temperature Trend
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} opacity={0.4} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#020617" : "#ffffff",
                      borderColor: isDark ? "#1e293b" : "#e2e8f0",
                      borderRadius: "12px", fontSize: "12px",
                      color: isDark ? "#f8fafc" : "#0f172a",
                    }}
                    labelStyle={{ fontWeight: "bold", color: isDark ? "#f8fafc" : "#0f172a" }}
                    formatter={(value: any, name: any) => [`${value}${tempUnit}`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Line type="monotone" dataKey="Max" stroke="#f59e0b" strokeWidth={3} activeDot={{ r: 6 }} dot={false} />
                  <Line type="monotone" dataKey="Min" stroke="#38bdf8" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ════ Weather alerts ════════════════════════════════════════════════ */}
          {weather.alerts && weather.alerts.length > 0 && (
            <div className="lg:col-span-3 rounded-3xl border border-red-500/30 bg-red-50/50 dark:bg-red-950/10 p-6 sm:p-8 shadow-xl dark:border-red-950/40">
              <h3 className="text-md font-bold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                <Triangle className="h-4 w-4 fill-red-500 text-red-500" />
                Weather Alerts ({weather.alerts.length})
              </h3>
              <div className="space-y-4">
                {weather.alerts.map((alert, idx) => (
                  <div key={idx} className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white/70 dark:bg-red-950/10 p-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <span className="text-sm font-bold text-red-700 dark:text-red-400">{alert.event}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">— {alert.sender_name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 text-right shrink-0">
                        {new Date(alert.start * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {" → "}
                        {new Date(alert.end * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">{alert.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* ════ Daily Forecast ══════════════════════════════════════════════ */}
          <div className="lg:col-span-3 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800/40 dark:bg-slate-950/20">
            <h3 className="text-md font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-sky-500 dark:text-sky-400" />
              {weather.daily?.length || 8}-Day Daily Forecast
            </h3>
            <div className={cn(
              "grid gap-4 grid-cols-2 sm:grid-cols-4",
              weather.daily?.length === 7 ? "lg:grid-cols-7" :
              weather.daily?.length === 6 ? "lg:grid-cols-6" :
              weather.daily?.length === 5 ? "lg:grid-cols-5" :
              "lg:grid-cols-8"
            )}>
              {weather.daily?.slice(0, 8).map((day, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 p-3 hover:bg-slate-100/60 dark:bg-slate-900/40 dark:border-slate-900/60 dark:hover:bg-slate-900/80 transition-all group"
                >
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {day.day_of_week.slice(0, 3)}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{day.date?.slice(5)}</span>

                  <div className="my-3 transform group-hover:scale-110 transition-transform">
                    {getWeatherIcon(day.icon, "h-7 w-7")}
                  </div>

                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize text-center line-clamp-1">
                    {day.description}
                  </span>

                  {/* High / Low */}
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-white">{fmtTemp(day.temp_max)}{tempUnit}</span>
                    <span className="text-slate-400 font-medium">{fmtTemp(day.temp_min)}{tempUnit}</span>
                  </div>

                  {/* PoP */}
                  {day.pop !== undefined && day.pop > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-500 dark:text-blue-400">
                      <Umbrella className="h-3 w-3" />{day.pop}%
                    </div>
                  )}

                  {/* UV */}
                  {day.uv_index !== undefined && (
                    <div className={cn("text-[10px] mt-0.5 font-semibold", uvLabel(day.uv_index).color)}>
                      UV {day.uv_index?.toFixed(0)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ════ Smart Activity & Farming Advisor ════════════════════════════ */}
          <div className="lg:col-span-3">
            <ActivityAdvisor
              current={weather.current}
              units={units}
            />
          </div>

          {/* ════ Weather radar map ════════════════════════════════════════════ */}
          <div className="lg:col-span-3">
            <WeatherMap
              lat={selectedCity.lat}
              lon={selectedCity.lon}
              cityName={selectedCity.name}
            />
          </div>

        </div>
      )}
    </div>
  );
}
