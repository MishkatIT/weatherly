"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, Thermometer, Cloud, CloudRain, Wind, ShieldAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeatherMapProps {
  lat: number;
  lon: number;
  cityName: string;
}

type MapLayer = "temp_new" | "clouds_new" | "precipitation_new" | "wind_new" | "pressure_new";

export default function WeatherMap({ lat, lon, cityName }: WeatherMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayer>("temp_new");
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);

  // Leaflet references
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const weatherTileLayerRef = useRef<any>(null);
  const baseTileLayerRef = useRef<any>(null);

  // Check if dark mode is active
  const [isDark, setIsDark] = useState(false);

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

  // ── Load Leaflet CDN Assets dynamically ────────────────────────────────────
  useEffect(() => {
    if ((window as any).L) {
      setIsLoaded(true);
      setLoadingMap(false);
      return;
    }

    // Load stylesheet
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    document.head.appendChild(link);

    // Load script
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.onload = () => {
      setIsLoaded(true);
      setLoadingMap(false);
    };
    document.head.appendChild(script);

    return () => {
      // Keep loaded in head to avoid reloading
    };
  }, []);

  // ── Initialize or update Map ───────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Base maps
    const darkUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const lightUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    const baseTileUrl = isDark ? darkUrl : lightUrl;

    if (!mapRef.current) {
      // First time initialization
      mapRef.current = L.map(mapContainerRef.current, {
        center: [lat, lon],
        zoom: 7,
        zoomControl: false,
        attributionControl: false,
      });

      // Add zoom control to bottom right
      L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

      // Base tile layer
      baseTileLayerRef.current = L.tileLayer(baseTileUrl, {
        maxZoom: 18,
      }).addTo(mapRef.current);

      // Current location marker
      markerRef.current = L.marker([lat, lon]).addTo(mapRef.current);
      markerRef.current.bindPopup(`<b>${cityName}</b>`).openPopup();
    } else {
      // Map already exists, update view & marker position
      mapRef.current.setView([lat, lon], 7);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
        markerRef.current.getPopup().setContent(`<b>${cityName}</b>`).openPopup();
      }

      // Update base tile layer style if theme changed
      if (baseTileLayerRef.current) {
        baseTileLayerRef.current.setUrl(baseTileUrl);
      }
    }

    // Update the Weather Overlay
    if (weatherTileLayerRef.current) {
      mapRef.current.removeLayer(weatherTileLayerRef.current);
    }

    // Proxy dynamic route layer url
    const weatherTileUrl = `/api/weather/map/${activeLayer}/{z}/{x}/{y}`;
    weatherTileLayerRef.current = L.tileLayer(weatherTileUrl, {
      maxZoom: 18,
      opacity: 0.65,
    }).addTo(mapRef.current);

    return () => {
      // Clean up map on unmount
    };
  }, [isLoaded, lat, lon, activeLayer, isDark, cityName]);

  // Clean up completely on component destruction
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const layers: { id: MapLayer; name: string; icon: React.ReactNode }[] = [
    { id: "temp_new", name: "Temperature", icon: <Thermometer className="h-4 w-4" /> },
    { id: "clouds_new", name: "Clouds", icon: <Cloud className="h-4 w-4" /> },
    { id: "precipitation_new", name: "Rain / Precip", icon: <CloudRain className="h-4 w-4" /> },
    { id: "wind_new", name: "Wind Speed", icon: <Wind className="h-4 w-4" /> },
  ];

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800/40 dark:bg-slate-950/20 flex flex-col h-[500px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h3 className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="h-4.5 w-4.5 text-sky-500 dark:text-sky-400" />
          Interactive Weather Radar Map
        </h3>

        {/* Layer Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800/40">
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200",
                activeLayer === layer.id
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {layer.icon}
              {layer.name}
            </button>
          ))}
        </div>
      </div>

      {/* Map display */}
      <div className="relative flex-1 rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800/65 bg-slate-100 dark:bg-slate-900/40 z-10">
        {loadingMap && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-950/80 z-20">
            <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            <span className="text-xs font-bold text-slate-500 mt-2">Loading interactive map...</span>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
