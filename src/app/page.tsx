"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  Loader2,
  AlertCircle,
  Thermometer,
  Droplets,
  Wind,
  Compass,
  Sparkles,
  Sun,
  Calendar,
  CloudRain,
  CloudLightning,
  CloudSnow,
  Cloud,
  ChevronRight,
  TrendingUp,
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
import { WeatherResponse, HourlyResponse } from "@/lib/weather-ai/types";
import { GeocodeResult } from "@/app/api/geocode/route";
import { cn } from "@/lib/utils";

function getWeatherGradient(description: string = "") {
  const desc = description.toLowerCase();
  if (desc.includes("clear") || desc.includes("sunny")) {
    return "from-amber-500/20 via-orange-400/10 to-sky-100/30 border-amber-500/20 dark:from-amber-950/30 dark:via-orange-950/15 dark:to-slate-900/50 dark:border-amber-950/40";
  }
  if (desc.includes("rain") || desc.includes("drizzle") || desc.includes("shower")) {
    return "from-blue-500/20 via-indigo-500/10 to-slate-100/40 border-blue-500/20 dark:from-indigo-950/35 dark:via-slate-900/40 dark:to-slate-950/60 dark:border-indigo-950/40";
  }
  if (desc.includes("thunder") || desc.includes("storm")) {
    return "from-purple-500/20 via-violet-600/10 to-slate-100/40 border-purple-500/20 dark:from-purple-950/35 dark:via-slate-900/40 dark:to-slate-950/60 dark:border-purple-950/40";
  }
  if (desc.includes("snow") || desc.includes("ice") || desc.includes("freeze")) {
    return "from-cyan-300/25 via-sky-300/10 to-slate-50/50 border-cyan-400/20 dark:from-cyan-950/30 dark:via-slate-900/40 dark:to-slate-950/60 dark:border-cyan-950/40";
  }
  return "from-slate-300/30 via-zinc-400/10 to-transparent border-slate-300/40 dark:from-slate-800/40 dark:via-zinc-900/20 dark:to-slate-950/60 dark:border-slate-800/60";
}

function getWeatherIcon(iconName: string = "", className: string = "h-6 w-6") {
  const icon = iconName.toLowerCase();
  if (icon.includes("sun") || icon.includes("clear")) {
    return <Sun className={cn("text-amber-400 dark:text-amber-400", className)} />;
  }
  if (icon.includes("rain") || icon.includes("drizzle")) {
    return <CloudRain className={cn("text-blue-500 dark:text-blue-400", className)} />;
  }
  if (icon.includes("thunder") || icon.includes("lightning")) {
    return <CloudLightning className={cn("text-purple-500 dark:text-purple-400", className)} />;
  }
  if (icon.includes("snow")) {
    return <CloudSnow className={cn("text-sky-400 dark:text-sky-300", className)} />;
  }
  return <Cloud className={cn("text-slate-400 dark:text-slate-400", className)} />;
}



export default function Home() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<GeocodeResult | null>(null);
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [isDark, setIsDark] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryWeatherTimestamp, setAiSummaryWeatherTimestamp] = useState<number | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Unit conversion helpers (API always fetches in metric: Celsius, km/h, mm)
  const formatTemp = (tempC: number) => {
    if (units === "imperial") {
      return Math.round((tempC * 9) / 5 + 32);
    }
    return Math.round(tempC);
  };

  const formatWindSpeed = (speedKmh: number) => {
    if (units === "imperial") {
      return Math.round(speedKmh * 0.621371);
    }
    return Math.round(speedKmh);
  };

  const formatPrecipitation = (precipMm: number) => {
    if (units === "imperial") {
      return Math.round(precipMm * 0.03937 * 100) / 100;
    }
    return precipMm;
  };

  // Load initial unit preference from localStorage on mount (client-side only)
  useEffect(() => {
    const savedUnits = localStorage.getItem("weatherly:units");
    if (savedUnits === "metric" || savedUnits === "imperial") {
      setUnits(savedUnits);
    }
  }, []);

  const handleToggleUnits = (newUnits: "metric" | "imperial") => {
    setUnits(newUnits);
    localStorage.setItem("weatherly:units", newUnits);
  };

  // Consolidated current + daily weather query
  const {
    data: weather,
    isLoading: isWeatherLoading,
    isError: isWeatherError,
    error: weatherError,
    dataUpdatedAt: weatherUpdatedAt,
  } = useQuery<WeatherResponse>({
    queryKey: ["weather", selectedCity?.lat, selectedCity?.lon],
    queryFn: async () => {
      if (!selectedCity) return null as any;
      const res = await fetch(
        `/api/weather/current?lat=${selectedCity.lat}&lon=${selectedCity.lon}&ai=false&units=metric`
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || "Failed to load weather data");
      }
      return res.json();
    },
    enabled: !!selectedCity,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });

  // Hourly query (ai=false for quota optimization)
  const { data: hourly, isLoading: isHourlyLoading } = useQuery<HourlyResponse>({
    queryKey: ["hourly", selectedCity?.lat, selectedCity?.lon],
    queryFn: async () => {
      if (!selectedCity) return null as any;
      const res = await fetch(
        `/api/weather/hourly?lat=${selectedCity.lat}&lon=${selectedCity.lon}&units=metric`
      );
      if (!res.ok) throw new Error("Failed to load hourly data");
      return res.json();
    },
    enabled: !!selectedCity,
    staleTime: 1000 * 60 * 10,
  });

  // Geocoding query
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

  // Reset AI summary when location or unit preference updates
  useEffect(() => {
    setAiSummary(null);
    setAiSummaryWeatherTimestamp(null);
    setAiError(null);
  }, [selectedCity, units]);

  // Load cached real AI summary automatically if available
  useEffect(() => {
    if (weather && weather.ai_summary && weather.is_fallback === false) {
      setAiSummary(weather.ai_summary);
      setAiSummaryWeatherTimestamp(weatherUpdatedAt);
    }
  }, [weather, weatherUpdatedAt]);

  // Reset AI summary when weather data is updated (re-fetched) and no longer matches
  useEffect(() => {
    if (
      aiSummary &&
      aiSummaryWeatherTimestamp &&
      weatherUpdatedAt &&
      weatherUpdatedAt > aiSummaryWeatherTimestamp
    ) {
      if (!weather || !weather.ai_summary || weather.is_fallback !== false) {
        setAiSummary(null);
        setAiSummaryWeatherTimestamp(null);
      }
    }
  }, [weather, weatherUpdatedAt, aiSummary, aiSummaryWeatherTimestamp]);

  // Invalidate usage stats when weather query is updated
  useEffect(() => {
    if (weatherUpdatedAt) {
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    }
  }, [weatherUpdatedAt, queryClient]);

  const handleFetchAiSummary = async () => {
    if (!selectedCity) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(
        `/api/weather/current?lat=${selectedCity.lat}&lon=${selectedCity.lon}&ai=true&units=metric`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Failed to retrieve AI summary");
      }
      const data = await res.json();
      setAiSummary(data.ai_summary);
      setAiSummaryWeatherTimestamp(weatherUpdatedAt);
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    } catch (err: any) {
      setAiError(err?.message || "Error generating AI summary");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Initialize selectedCity on mount
  useEffect(() => {
    // City Location Load
    const saved = localStorage.getItem("weatherly:last_searched_city");
    if (saved) {
      try {
        setSelectedCity(JSON.parse(saved));
        return;
      } catch (err) {
        console.error("Failed to parse last searched city:", err);
      }
    }
    detectLocation();
  }, []);

  // Sync state with global HTML class theme toggles (via MutationObserver)
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const detectLocation = async (usePrecise = false) => {
    setIsDetecting(true);

    // Helper function to resolve reverse geocode and set city
    const resolveAndSetLocation = async (lat: number, lon: number): Promise<boolean> => {
      try {
        const geoRes = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
        if (geoRes.ok) {
          const results = await geoRes.json();
          const result = Array.isArray(results) ? results[0] : results;
          if (result && result.lat !== undefined && result.lon !== undefined) {
            const loc = {
              display_name: result.display_name,
              name: result.name || result.city || "Local Area",
              lat: Number(result.lat),
              lon: Number(result.lon),
              city: result.city || result.name || "Local Area",
              country: result.country || "Detected Location",
            };
            setSelectedCity(loc);
            localStorage.setItem("weatherly:last_searched_city", JSON.stringify(loc));
            setIsDetecting(false);
            return true;
          }
        }
      } catch (err) {
        console.error("Failed to reverse geocode browser location:", err);
      }
      return false;
    };

    // 1. Try Browser Geolocation API first if requested explicitly
    if (usePrecise && typeof window !== "undefined" && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });
        
        const { latitude, longitude } = position.coords;
        const success = await resolveAndSetLocation(latitude, longitude);
        if (success) return;
      } catch (err) {
        console.warn("Browser geolocation failed or permission denied, falling back to IP-based location:", err);
      }
    }

    // 2. Fallback: IP-based detection (if browser geolocation is not requested, unavailable, or denied/fails)
    try {
      const res = await fetch("/api/weather/auto");
      if (res.ok) {
        const data = await res.json();
        if (data && data.location) {
          const loc = {
            display_name: `${data.location.city}, ${data.location.country}`,
            name: data.location.city,
            lat: data.location.lat,
            lon: data.location.lon,
            city: data.location.city,
            country: data.location.country,
          };
          setSelectedCity(loc);
          localStorage.setItem("weatherly:last_searched_city", JSON.stringify(loc));
          setIsDetecting(false);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to auto-detect location via IP:", err);
    }
    
    // 3. Last fallback (if both browser and IP geolocations fail)
    const fallback = {
      display_name: "New York City, New York, United States",
      name: "New York",
      lat: 40.7128,
      lon: -74.0060,
      city: "New York City",
      state: "New York",
      country: "United States",
    };
    setSelectedCity(fallback);
    localStorage.setItem("weatherly:last_searched_city", JSON.stringify(fallback));
    setIsDetecting(false);
  };

  // Debounce search term by 600ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle city selection
  const handleSelectCity = (city: GeocodeResult) => {
    setSelectedCity(city);
    localStorage.setItem("weatherly:last_searched_city", JSON.stringify(city));
    setSearchTerm(""); // clear search bar input
    setDebouncedSearch(""); // clear debounced string to hide suggestions list
  };

  // Map Recharts line data
  const chartData = weather?.daily?.map((day) => ({
    name: day.day_of_week,
    Max: Math.round(day.temp_max),
    Min: Math.round(day.temp_min),
  })) || [];

  return (
    <div className="space-y-8 animate-fade-in text-slate-900 dark:text-slate-55">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Weather Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Detects your geolocation using your network IP or search globally to view telemetry.
          </p>
        </div>

        {/* Theme and Unit Switcher Header Panel */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
          {/* Unit Switcher */}
          <div className="flex items-center bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-0.5 rounded-xl shadow-sm">
            <button
              onClick={() => handleToggleUnits("metric")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200",
                units === "metric"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              Celsius (°C)
            </button>
            <button
              onClick={() => handleToggleUnits("imperial")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200",
                units === "imperial"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              Fahrenheit (°F)
            </button>
          </div>
        </div>
      </div>

      {/* Search Input Container */}
      <div className="flex gap-3 max-w-xl">
        <div className="relative flex-1">
          <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-sky-550/50 focus-within:ring-2 focus-within:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-900/50 dark:focus-within:border-sky-500/50 dark:focus-within:ring-sky-500/20 transition-all shadow-sm">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search city (e.g. London, Dhaka, Tokyo)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-0 px-3 py-0 text-slate-900 placeholder-slate-400 dark:text-white dark:placeholder-slate-500 focus:outline-none focus:ring-0 sm:text-sm"
            />
            {isGeocoding && <Loader2 className="h-4 w-4 animate-spin text-slate-450" />}
          </div>

          {/* Suggestion Dropdown */}
          {geocodeResults && geocodeResults.length > 0 && (
            <div className="absolute top-full left-0 z-50 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-950">
              <ul className="space-y-0.5">
                {geocodeResults.map((result, idx) => (
                  <li key={idx}>
                    <button
                      onClick={() => handleSelectCity(result)}
                      className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm text-slate-650 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 dark:text-white">{result.name}</span>
                        <span className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {result.display_name}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-450" />
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

      {/* Default Prompt when no location selected */}
      {!selectedCity && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 px-6 text-center dark:border-slate-850 dark:bg-slate-950/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 mb-4">
            <MapPin className="h-6 w-6" />
          </div>
          <h3 className="text-md font-bold text-slate-900 dark:text-white">No City Selected</h3>
          <p className="max-w-xs text-sm text-slate-500 mt-1">
            Detecting local location or search above to view climate telemetry.
          </p>
        </div>
      )}

      {/* Loading State for Weather details */}
      {isWeatherLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-sky-500 dark:text-sky-400" />
          <span className="text-xs text-slate-500 mt-3 font-semibold">Retrieving climate data...</span>
        </div>
      )}

      {/* Error state */}
      {isWeatherError && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/5 py-12 px-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Retrieval Failed</h3>
          <p className="max-w-md text-sm text-slate-550 dark:text-slate-400 mt-2">
            {weatherError instanceof Error ? weatherError.message : "Unable to retrieve weather telemetry details."}
          </p>
        </div>
      )}

      {/* Active Dashboard Grid */}
      {weather && selectedCity && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Weather Card */}
          <div
            className={cn(
              "lg:col-span-2 relative overflow-hidden rounded-3xl border p-6 sm:p-8 flex flex-col justify-between shadow-xl backdrop-blur-sm bg-gradient-to-b border-slate-200/80 dark:border-slate-800/40 bg-white/70 dark:bg-slate-900/40",
              getWeatherGradient(weather.current.description)
            )}
          >

            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <MapPin className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                  <span className="text-xs font-bold tracking-wide uppercase">
                    Local Area Weather
                  </span>
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {selectedCity.name}
                  {selectedCity.country && (
                    <span className="text-slate-500 dark:text-slate-400 font-semibold text-2xl">, {selectedCity.country}</span>
                  )}
                </h2>
                <span className="inline-block text-[10px] bg-slate-100 dark:bg-slate-900/80 px-2 py-0.5 rounded-md text-slate-500 dark:text-slate-550 font-mono">
                  LAT: {selectedCity.lat.toFixed(3)} / LON: {selectedCity.lon.toFixed(3)}
                </span>
              </div>
              <div className="p-4 bg-white/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 shadow-sm backdrop-blur-md">
                {getWeatherIcon(weather.current.icon, "h-12 w-12")}
              </div>
            </div>

            <div className="my-8 flex items-baseline gap-2 relative z-10">
              <span className="text-7xl sm:text-8xl font-black tracking-tighter text-slate-900 dark:text-white">
                {formatTemp(weather.current.temp)}°{units === "metric" ? "C" : "F"}
              </span>
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white capitalize leading-tight">
                  {weather.current.description}
                </span>
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Feels like <span className="font-semibold text-slate-800 dark:text-slate-200">{formatTemp(weather.current.feels_like)}°{units === "metric" ? "C" : "F"}</span>
                </span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-slate-200 dark:border-slate-800/40 pt-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900/60 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200/50 dark:border-0">
                  <Thermometer className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase font-semibold">Feels Like</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {formatTemp(weather.current.feels_like)}°{units === "metric" ? "C" : "F"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900/60 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200/50 dark:border-0">
                  <Droplets className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase font-semibold">Humidity</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{weather.current.humidity}%</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900/60 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200/50 dark:border-0">
                  <Wind className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase font-semibold">Wind</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {formatWindSpeed(weather.current.wind_speed)} {units === "metric" ? "km/h" : "mph"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900/60 text-sky-650 dark:text-sky-400 shadow-sm border border-slate-200/50 dark:border-0">
                  <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase font-semibold">UV Index</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {weather.current.uv_index !== undefined ? weather.current.uv_index : 3}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 col-span-2 md:col-span-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900/60 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200/50 dark:border-0">
                  <CloudRain className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase font-semibold">Rain</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {formatPrecipitation(weather.current.precipitation !== undefined ? weather.current.precipitation : 0)} {units === "metric" ? "mm" : "in"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights summary */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-xl backdrop-blur-sm dark:border-slate-800/40 dark:bg-slate-950/45">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                </div>
                <h3 className="text-md font-bold text-slate-900 dark:text-white">AI Summary Insight</h3>
              </div>
              {aiSummary ? (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic font-normal">
                  &ldquo;{aiSummary}&rdquo;
                </p>
              ) : isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-sky-500 dark:text-sky-400" />
                  <span className="text-xs text-slate-550 dark:text-slate-500 font-medium">Generating weather insights...</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3 py-2">
                  <button
                    onClick={handleFetchAiSummary}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold text-xs py-2.5 px-4 shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all duration-200 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate AI Summary
                  </button>
                  <p className="text-[10px] text-slate-500 leading-normal text-center">
                    Uses upstream generative model (Gemini) to synthesize local environment telemetry. Trigger manually to optimize API quota limits.
                  </p>
                  {aiError && (
                    <span className="text-[11px] text-red-500 text-center font-medium mt-1">
                      {aiError}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 dark:border-slate-900 pt-4 mt-6 text-[10px] text-slate-500 flex justify-between">
              <span>Forecast Analysis</span>
              <span>Gemini Engine</span>
            </div>
          </div>

          {/* Forecast Trend Chart */}
          <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800/40 dark:bg-slate-950/20">
            <h3 className="text-md font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-sky-500 dark:text-sky-400" />
              7-Day Temperature Trend
            </h3>
            
            <div className="h-64 w-full text-slate-700 dark:text-slate-350">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} opacity={0.4} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#020617" : "#ffffff",
                      borderColor: isDark ? "#1e293b" : "#e2e8f0",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: isDark ? "#f8fafc" : "#0f172a",
                    }}
                    labelStyle={{ fontWeight: "bold", color: isDark ? "#f8fafc" : "#0f172a" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Line type="monotone" dataKey="Max" stroke="#f59e0b" strokeWidth={3} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Min" stroke="#38bdf8" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hourly strip forecast */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl flex flex-col justify-between dark:border-slate-800/40 dark:bg-slate-950/20">
            <div>
              <h3 className="text-md font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Compass className="h-4.5 w-4.5 text-sky-550 dark:text-sky-400" />
                Hourly Forecast
              </h3>
              
              {isHourlyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-slate-500" />
                </div>
              ) : (
                <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {hourly?.hourly?.slice(0, 8).map((hour, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-2.5 hover:bg-slate-100 dark:bg-slate-900/40 dark:border-slate-900/60 dark:hover:bg-slate-900/80 transition-colors"
                    >
                      <span className="text-xs text-slate-500 dark:text-slate-400">{hour.time}</span>
                      <div className="flex items-center gap-2">
                        {getWeatherIcon(hour.icon, "h-4 w-4")}
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{formatTemp(hour.temp)}°</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-500 capitalize line-clamp-1">
                        {hour.description}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <span className="text-[10px] text-slate-450 dark:text-slate-500 text-right mt-4 border-t border-slate-100 dark:border-slate-900 pt-3">
              Quota Optimized
            </span>
          </div>

          {/* 7-Day Daily Forecast Cards List */}
          <div className="lg:col-span-3 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800/40 dark:bg-slate-950/20">
            <h3 className="text-md font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-sky-550 dark:text-sky-400" />
              7-Day Daily Forecast Cards
            </h3>
            
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
              {weather.daily?.map((day, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 p-4 hover:bg-slate-100/55 dark:bg-slate-900/40 dark:border-slate-900/60 dark:hover:bg-slate-900/80 transition-all duration-200 group"
                >
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {day.day_of_week.slice(0, 3)}
                  </span>
                  
                  <div className="my-3.5 transform group-hover:scale-110 transition-transform duration-200">
                    {getWeatherIcon(day.icon, "h-8 w-8")}
                  </div>
                  
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 capitalize text-center line-clamp-1">
                    {day.description}
                  </span>

                  <div className="flex items-center gap-2 mt-3 text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {formatTemp(day.temp_max)}°
                    </span>
                    <span className="text-slate-400 font-medium">
                      {formatTemp(day.temp_min)}°
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
