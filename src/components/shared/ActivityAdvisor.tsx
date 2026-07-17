"use client";

import { Leaf, Dumbbell, Sun, ShieldAlert, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { CurrentWeather } from "@/lib/weather-ai/types";
import { cn } from "@/lib/utils";

interface ActivityAdvisorProps {
  current: CurrentWeather;
  units: "metric" | "imperial";
}

interface AdviceItem {
  status: "success" | "warning" | "danger" | "info";
  title: string;
  message: string;
}

export default function ActivityAdvisor({ current, units }: ActivityAdvisorProps) {
  const tempC = current.temp;
  const humidity = current.humidity;
  const windKmh = current.wind_speed;
  const uv = current.uv_index;
  const aqi = current.aqi;
  const rain = current.precipitation ?? 0;

  // ── 1. Farming & Gardening Rules ──────────────────────────────────────────
  const getFarmingAdvice = (): AdviceItem => {
    if (tempC < 5) {
      return {
        status: "danger",
        title: "Frost Risk",
        message: "Temperatures are near freezing. Avoid planting sensitive crops. Protect seedlings and cover delicate plants.",
      };
    }
    if (rain > 5) {
      return {
        status: "info",
        title: "Heavy Rainfall",
        message: "Significant rain detected. Natural irrigation is sufficient. Postpone any manual watering to prevent root rot.",
      };
    }
    if (windKmh > 30) {
      return {
        status: "warning",
        title: "High Winds",
        message: "Winds are strong. Avoid spraying pesticides or liquid fertilizers as they will drift. Secure tall plants.",
      };
    }
    if (tempC > 30 && humidity < 40) {
      return {
        status: "warning",
        title: "High Evaporation",
        message: "Hot and dry conditions. Soil moisture will deplete quickly. Water crops in the early morning or evening.",
      };
    }
    return {
      status: "success",
      title: "Optimal Conditions",
      message: "Great conditions for general crop maintenance, pruning, weeding, and transplanting seedlings.",
    };
  };

  // ── 2. Outdoor Sports & Exercise Rules ────────────────────────────────────
  const getExerciseAdvice = (): AdviceItem => {
    if (aqi !== undefined && aqi >= 4) {
      return {
        status: "danger",
        title: "Poor Air Quality",
        message: `Air pollution levels are high (AQI: ${aqi}). Limit intense outdoor cardio workouts. Move training indoors.`,
      };
    }
    if (tempC > 35) {
      return {
        status: "danger",
        title: "Extreme Heat",
        message: "Risk of heat exhaustion. Avoid intense outdoor workouts between 10 AM and 4 PM. Keep workouts light and drink plenty of water.",
      };
    }
    if (rain > 2) {
      return {
        status: "warning",
        title: "Wet Conditions",
        message: "Precipitation detected. Watch out for slippery pavements, paths, and trails. Dress in water-resistant layers.",
      };
    }
    if (tempC < 0) {
      return {
        status: "warning",
        title: "Freezing Weather",
        message: "Freezing temperatures. Warm up thoroughly indoors first. Wear wind-blocking layers and protect extremities.",
      };
    }
    return {
      status: "success",
      title: "Perfect for Cardio",
      message: "Temperature, air quality, and wind are optimal for running, cycling, or outdoor sports.",
    };
  };

  // ── 3. Sun Safety & Travel Rules ──────────────────────────────────────────
  const getSunAdvice = (): AdviceItem => {
    if (uv !== undefined && uv >= 6) {
      return {
        status: "danger",
        title: "High UV Radiation",
        message: `UV index is ${uv.toFixed(1)}. Apply sunscreen (SPF 30+), wear a wide-brimmed hat, sunglasses, and seek shade during midday hours.`,
      };
    }
    if (current.visibility !== undefined && current.visibility < 3) {
      return {
        status: "warning",
        title: "Low Visibility",
        message: `Visibility is reduced to ${current.visibility} km. Slow down when driving. Use low-beam headlights or fog lights.`,
      };
    }
    if (uv !== undefined && uv >= 3 && uv < 6) {
      return {
        status: "warning",
        title: "Moderate UV Index",
        message: `UV index is ${uv.toFixed(1)}. Sun protection is recommended if you plan to stay outdoors for more than 45 minutes.`,
      };
    }
    return {
      status: "success",
      title: "Safe Sun Levels",
      message: "UV index is low. Safe for standard outdoor travel and sightseeing without heavy sun precautions.",
    };
  };

  const adviceSections = [
    {
      id: "farming",
      label: "Farming & Gardening",
      icon: <Leaf className="h-5 w-5 text-emerald-500" />,
      advice: getFarmingAdvice(),
    },
    {
      id: "exercise",
      label: "Outdoor Workouts",
      icon: <Dumbbell className="h-5 w-5 text-indigo-500" />,
      advice: getExerciseAdvice(),
    },
    {
      id: "sun",
      label: "Sun Safety & Travel",
      icon: <Sun className="h-5 w-5 text-amber-500" />,
      advice: getSunAdvice(),
    },
  ];

  const getStatusStyle = (status: AdviceItem["status"]) => {
    switch (status) {
      case "danger":
        return {
          container: "bg-red-500/5 border-red-200 dark:border-red-900/35",
          badge: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
          icon: <ShieldAlert className="h-4 w-4" />,
        };
      case "warning":
        return {
          container: "bg-amber-500/5 border-amber-200 dark:border-amber-900/35",
          badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400",
          icon: <AlertTriangle className="h-4 w-4" />,
        };
      case "info":
        return {
          container: "bg-sky-500/5 border-sky-200 dark:border-sky-900/35",
          badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
          icon: <HelpCircle className="h-4 w-4" />,
        };
      default:
        return {
          container: "bg-emerald-500/5 border-emerald-200 dark:border-emerald-900/35",
          badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
          icon: <CheckCircle2 className="h-4 w-4" />,
        };
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800/40 dark:bg-slate-950/20">
      <h3 className="text-md font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <Leaf className="h-4.5 w-4.5 text-sky-500" />
        Smart Activity & Farming Advisor
      </h3>

      <div className="grid gap-6 md:grid-cols-3">
        {adviceSections.map((sec) => {
          const styles = getStatusStyle(sec.advice.status);
          return (
            <div
              key={sec.id}
              className={cn(
                "rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-md",
                styles.container
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    {sec.icon}
                    <span className="text-xs font-extrabold text-slate-750 dark:text-slate-200">{sec.label}</span>
                  </div>
                  <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider", styles.badge)}>
                    {styles.icon}
                    {sec.advice.title}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {sec.advice.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
