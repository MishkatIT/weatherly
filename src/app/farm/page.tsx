"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud,
  FileImage,
  Sprout,
  Trash2,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Compass,
  ArrowRight,
  TrendingUp,
  Sparkles,
  PieChart as PieIcon,
  ChevronRight,
  Activity,
  Plus,
  Loader2,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { TreeAnalysisResult, TreesQuotaResponse } from "@/lib/weather-ai/types";
import { cn } from "@/lib/utils";

export default function FarmAnalyzer() {
  const queryClient = useQueryClient();
  
  // Local state for image upload and inputs
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [acres, setAcres] = useState<string>("");
  const [farmerId, setFarmerId] = useState<string>("");
  const [county, setCounty] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  
  const [activeTab, setActiveTab] = useState<"original" | "annotated">("original");
  const [isDark, setIsDark] = useState(false);

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

  // Query remaining trees quota (cached 5 mins)
  const { data: quota, refetch: refetchQuota } = useQuery<TreesQuotaResponse>({
    queryKey: ["trees-quota"],
    queryFn: async () => {
      const res = await fetch("/api/trees/quota");
      if (!res.ok) throw new Error("Failed to fetch trees quota");
      return res.json();
    },
  });

  // Mutation to handle trees analysis post request
  const analysisMutation = useMutation<TreeAnalysisResult, Error, FormData>({
    mutationFn: async (formData) => {
      const res = await fetch("/api/trees/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || "Tree canopy analysis failed. Check file type and limits."
        );
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate the usage stats query to immediately update the floating widget quota bar
      queryClient.invalidateQueries({ queryKey: ["usage"] });
      // Invalidate/refetch trees remaining quota
      refetchQuota();
    },
  });

  // Handle image dropping / selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setActiveTab("original");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setActiveTab("original");
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    analysisMutation.reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) return;

    const formData = new FormData();
    formData.append("image", imageFile);
    
    if (acres.trim()) {
      formData.append("landAcres", acres);
    }
    if (farmerId.trim()) {
      formData.append("farmerId", farmerId);
    }
    if (county.trim()) {
      formData.append("county", county);
    }
    if (notes.trim()) {
      formData.append("notes", notes);
    }

    analysisMutation.mutate(formData);
  };

  // Setup data for the health breakdown Recharts pie chart
  const breakdownData = analysisMutation.data
    ? [
        {
          name: "Healthy",
          value: analysisMutation.data.health_breakdown.healthy,
          color: "#10b981", // Emerald
        },
        {
          name: "Stressed",
          value: analysisMutation.data.health_breakdown.stressed,
          color: "#f59e0b", // Amber
        },
        {
          name: "Diseased/Dead",
          value: analysisMutation.data.health_breakdown.dead_or_diseased,
          color: "#ef4444", // Red
        },
      ].filter((item) => item.value > 0)
    : [];

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-50">

      {/* Premium Plan Notice Banner */}
      <div className="flex items-start gap-4 rounded-2xl border border-amber-200/70 dark:border-amber-500/20 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 px-5 py-4 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Premium Feature — Paid Plan Required</p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5 leading-relaxed">
            The Farm Canopy Analyzer uses WeatherAI's Forestry Vision API, which is not included in the free tier.
            Results shown are generated locally as a preview demonstration.
            To enable live AI-powered tree detection and canopy health analysis,{" "}
            <a
              href="https://weather-ai.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2 text-amber-800 dark:text-amber-300 hover:text-orange-700 dark:hover:text-amber-200 transition-colors"
            >
              upgrade your WeatherAI plan →
            </a>
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Farm Canopy Analyzer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Upload aerial drone imagery to perform AI object detection on tree count, health, and distribution.
          </p>
        </div>
        
        {/* Remaining quota display */}
        {quota && (
          <div className="self-start rounded-2xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/50 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
            Trees Quota: <span className="text-emerald-500 dark:text-emerald-400 font-bold">{quota.remaining_uploads}</span> / {quota.limit_uploads} remaining
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="grid gap-8 lg:grid-cols-5">
        {/* Upload form / image selector panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/40 bg-white/70 dark:bg-slate-900/40 p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-sky-500 dark:text-sky-400" />
              Configure Analysis
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* File Drop zone */}
              {!imagePreview ? (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl py-12 px-4 text-center cursor-pointer hover:border-sky-500/40 hover:bg-sky-500/5 transition-all group"
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 group-hover:scale-110 transition-transform text-slate-500 dark:text-slate-400">
                    <FileImage className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white mt-4">
                    Upload plot image
                  </span>
                  <span className="text-xs text-slate-500 mt-1 max-w-xs">
                    Drag and drop or click to select image. Supports JPEG, PNG, or WEBP (Max 20MB).
                  </span>
                  <input
                    type="file"
                    id="file-input"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 p-2 group">
                  <img
                    src={imagePreview}
                    alt="Upload Preview"
                    className="h-48 w-full object-cover rounded-xl"
                  />
                  <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="rounded-lg bg-red-600 p-2 text-white shadow-lg hover:bg-red-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold truncate max-w-[180px]">
                      {imageFile?.name}
                    </span>
                    <span>{(imageFile!.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                </div>
              )}

              {/* Metadata Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Land Acres
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    placeholder="e.g. 5.4"
                    value={acres}
                    onChange={(e) => setAcres(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900/40 px-3.5 py-2.5 text-xs dark:text-white placeholder-slate-450 dark:placeholder-slate-650 focus:border-sky-500/50 focus:outline-none transition-colors shadow-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Plot ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. F-102"
                    value={farmerId}
                    onChange={(e) => setFarmerId(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900/40 px-3.5 py-2.5 text-xs dark:text-white placeholder-slate-450 dark:placeholder-slate-650 focus:border-sky-500/50 focus:outline-none transition-colors shadow-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Location Region / County
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kericho County"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900/40 px-3.5 py-2.5 text-xs dark:text-white placeholder-slate-450 dark:placeholder-slate-650 focus:border-sky-500/50 focus:outline-none transition-colors shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Agronomic Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Avocado orchard under drip irrigation..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900/40 px-3.5 py-2.5 text-xs dark:text-white placeholder-slate-450 dark:placeholder-slate-650 focus:border-sky-500/50 focus:outline-none transition-colors shadow-sm"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!imageFile || analysisMutation.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                {analysisMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing Tree Canopy...
                  </>
                ) : (
                  <>
                    <Sprout className="h-4 w-4" />
                    Submit for Analysis
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Mutation Error display */}
          {analysisMutation.isError && (
            <div className="flex gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div className="space-y-1">
                <span className="font-bold text-red-650 dark:text-red-400">Analysis Failed</span>
                <p className="text-slate-650 dark:text-slate-400 leading-relaxed">
                  {analysisMutation.error.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3 space-y-6">
          {/* Default state when no results exist */}
          {!analysisMutation.data && !analysisMutation.isPending && (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 py-32 px-6 text-center h-full">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900/50 text-slate-500 border border-slate-200 dark:border-slate-800 mb-4">
                <Sprout className="h-6 w-6" />
              </div>
              <h3 className="text-md font-bold text-slate-900 dark:text-white">Analysis Awaiting</h3>
              <p className="max-w-xs text-sm text-slate-500 mt-1">
                Upload a farm or forest plot aerial snapshot to generate tree count, health indices, and agronomic annotations.
              </p>
            </div>
          )}

          {/* Loading status panel */}
          {analysisMutation.isPending && (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-950/20 py-32 px-6 text-center h-full">
              <Loader2 className="h-10 w-10 animate-spin text-sky-500 dark:text-sky-400" />
              <h3 className="text-md font-bold text-slate-900 dark:text-white mt-4">Running Computer Vision</h3>
              <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                WeatherAI models are running tree object segmentation, clustering, and health signature analysis...
              </p>
            </div>
          )}

          {/* Successful result rendering */}
          {analysisMutation.data && (
            <div className="space-y-6 animate-fade-in">
              {/* Summary telemetry boxes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 p-4">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Trees Counted</span>
                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {analysisMutation.data.tree_count}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 p-4">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tree Density</span>
                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {analysisMutation.data.density_per_acre
                      ? `${analysisMutation.data.density_per_acre.toFixed(1)} / acre`
                      : "N/A"}
                  </div>
                </div>
              </div>

              {/* Tabs for Original vs. Annotated Image */}
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/40 bg-white/40 dark:bg-slate-950/30 overflow-hidden shadow-xl">
                <div className="flex border-b border-slate-200 dark:border-slate-900 bg-slate-100/50 dark:bg-slate-900/20 px-4 pt-3 gap-2">
                  <button
                    onClick={() => setActiveTab("original")}
                    className={cn(
                      "px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer",
                      activeTab === "original"
                        ? "text-slate-900 border-sky-500 dark:border-sky-400 bg-white dark:bg-slate-950 dark:text-white"
                        : "text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-300"
                    )}
                  >
                    Original Image
                  </button>
                  <button
                    onClick={() => setActiveTab("annotated")}
                    className={cn(
                      "px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer",
                      activeTab === "annotated"
                        ? "text-slate-900 border-sky-500 dark:border-sky-400 bg-white dark:bg-slate-950 dark:text-white"
                        : "text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-300"
                    )}
                  >
                    AI Annotated Overlay
                  </button>
                </div>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-center min-h-[250px]">
                  {activeTab === "original" ? (
                    <img
                      src={imagePreview || ""}
                      alt="Original Plot"
                      className="max-h-96 w-full object-contain rounded-xl"
                    />
                  ) : (
                    <img
                      src={analysisMutation.data.annotated_image_url}
                      alt="Annotated Plot"
                      className="max-h-96 w-full object-contain rounded-xl border border-sky-500/20"
                    />
                  )}
                </div>
              </div>

              {/* Health Pie Chart Breakdown */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/30 p-6 flex flex-col justify-between shadow-md">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <PieIcon className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                    Canopy Health Index
                  </h4>
                  
                  <div className="h-44 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={breakdownData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {breakdownData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#020617" : "#ffffff",
                            borderColor: isDark ? "#1e293b" : "#e2e8f0",
                            borderRadius: "12px",
                            fontSize: "11px",
                            color: isDark ? "#f8fafc" : "#0f172a",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legend breakdown list */}
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="flex flex-col rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Healthy</span>
                      <span className="text-sm font-extrabold text-slate-950 dark:text-white mt-0.5">
                        {analysisMutation.data.health_breakdown.healthy}
                      </span>
                    </div>
                    <div className="flex flex-col rounded-lg bg-amber-500/5 border border-amber-500/10 p-2">
                      <span className="font-bold text-amber-600 dark:text-amber-400">Stressed</span>
                      <span className="text-sm font-extrabold text-slate-950 dark:text-white mt-0.5">
                        {analysisMutation.data.health_breakdown.stressed}
                      </span>
                    </div>
                    <div className="flex flex-col rounded-lg bg-red-500/5 border border-red-500/10 p-2">
                      <span className="font-bold text-red-600 dark:text-red-400">Dead/Diseased</span>
                      <span className="text-sm font-extrabold text-slate-950 dark:text-white mt-0.5">
                        {analysisMutation.data.health_breakdown.dead_or_diseased}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Observations Panel */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/30 p-6 shadow-md space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-sky-500 dark:text-sky-400 animate-pulse" />
                    Computer Vision Observations
                  </h4>
                  
                  <ul className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {analysisMutation.data.observations?.map((obs, idx) => (
                      <li key={idx} className="flex gap-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                        <ChevronRight className="h-4 w-4 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations list */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/30 p-6 shadow-md space-y-4">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                  Agronomic & Crop Care Recommendations
                </h4>
                
                <ul className="grid gap-3 sm:grid-cols-2">
                  {analysisMutation.data.recommendations?.map((rec, idx) => (
                    <li
                      key={idx}
                      className="flex gap-3 rounded-2xl border border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/25 p-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-500 dark:text-sky-400 text-[10px] font-bold">
                        {idx + 1}
                      </div>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
