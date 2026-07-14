"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronUp, ChevronDown, RefreshCw, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageData {
  requests_count: number;
  requests_limit: number;
  ai_requests_count: number;
  ai_requests_limit: number;
  billing_period_end: string;
}

export default function UsageWidget() {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<UsageData>({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      if (!res.ok) {
        throw new Error("Failed to fetch usage data");
      }
      return res.json();
    },
    refetchInterval: 1000 * 60 * 5, // Auto refetch every 5 minutes
  });

  const reqPct = data ? Math.min(100, ((data.requests_count ?? 0) / (data.requests_limit ?? 1000)) * 100) : 0;
  const aiPct = data ? Math.min(100, ((data.ai_requests_count ?? 0) / (data.ai_requests_limit ?? 200)) * 100) : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {/* Expanded Card */}
      <div
        className={cn(
          "w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95 shadow-2xl transition-all duration-300 ease-in-out backdrop-blur-md",
          isOpen
            ? "translate-y-0 opacity-100 scale-100 pointer-events-auto mb-2"
            : "translate-y-4 opacity-0 scale-95 pointer-events-none absolute"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 dark:border-slate-900 dark:bg-slate-900/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500 dark:text-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold text-slate-950 dark:text-white">WeatherAI Usage Stats</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs text-slate-450 dark:text-slate-500">Loading quota details...</span>
            </div>
          )}

          {isError && (
            <div className="py-2 text-center">
              <span className="text-xs text-red-500 dark:text-red-400">Failed to load API usage</span>
            </div>
          )}

          {data && (
            <>
              {/* General API Requests */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-550 dark:text-slate-400">API Requests</span>
                  <span className="font-medium text-slate-850 dark:text-slate-200">
                    {(data.requests_count ?? 0).toLocaleString()} / {(data.requests_limit ?? 1000).toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      reqPct > 85 ? "bg-red-500" : reqPct > 60 ? "bg-amber-500" : "bg-sky-500"
                    )}
                    style={{ width: `${reqPct}%` }}
                  />
                </div>
              </div>

              {/* AI Insight Requests */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-550 dark:text-slate-400">AI Summary Requests</span>
                  <span className="font-medium text-slate-850 dark:text-slate-200">
                    {(data.ai_requests_count ?? 0).toLocaleString()} / {(data.ai_requests_limit ?? 200).toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      aiPct > 85 ? "bg-red-500" : aiPct > 60 ? "bg-amber-500" : "bg-indigo-600 dark:bg-indigo-500"
                    )}
                    style={{ width: `${aiPct}%` }}
                  />
                </div>
              </div>

              {/* Reset period */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-900 flex justify-between items-center text-[10px] text-slate-500">
                <span>Cycle Ends</span>
                <span>{data.billing_period_end ? new Date(data.billing_period_end).toLocaleDateString() : "N/A"}</span>
              </div>

              {/* Local tracking notice */}
              <div className="text-[9px] text-slate-450 dark:text-slate-500 text-center mt-3 pt-1 border-t border-slate-100/50 dark:border-slate-900/50 italic">
                * Tracked on application server to optimize WeatherAI API quota usage.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Badge Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-lg shadow-black/10 dark:border-slate-800 dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-200 active:scale-95 group",
          isOpen
            ? "text-slate-950 dark:text-white border-slate-350 dark:border-slate-700 bg-slate-100 dark:bg-slate-900"
            : "text-slate-650 dark:text-slate-300"
        )}
      >
        <BarChart3 className="h-4 w-4 text-sky-500 dark:text-sky-400 group-hover:scale-110 transition-transform" />
        <span className="text-xs font-semibold select-none">
          {data ? `${data.requests_count ?? 0}/${data.requests_limit ?? 1000}` : "API Usage"}
        </span>
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-450 dark:text-slate-500" />}
      </button>
    </div>
  );
}
