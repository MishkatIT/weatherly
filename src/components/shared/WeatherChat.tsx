"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function WeatherChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am Weatherly AI. Ask me anything about the current weather conditions, outdoor activities, or clothing recommendations for the active city!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeCity, setActiveCity] = useState<any>(null);
  const [suggestedCity, setSuggestedCity] = useState<any>(null);

  // Auto-focus input when chat window is opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ── Sync Active City state ─────────────────────────────────────────────────
  const updateActiveCity = () => {
    const saved = localStorage.getItem("weatherly:last_searched_city");
    if (saved) {
      try {
        setActiveCity(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to parse active city:", err);
      }
    }
  };

  useEffect(() => {
    updateActiveCity();

    // Listen to custom event when user searches/detects new city on main dashboard
    const handleCityChange = () => updateActiveCity();
    window.addEventListener("weatherly:city_changed", handleCityChange);
    // Also listen to storage events
    window.addEventListener("storage", handleCityChange);

    return () => {
      window.removeEventListener("weatherly:city_changed", handleCityChange);
      window.removeEventListener("storage", handleCityChange);
    };
  }, []);

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // ── Fetch active weather context from API ──────────────────────────────────
  const fetchActiveWeatherContext = async () => {
    if (!activeCity) return null;
    try {
      const res = await fetch(`/api/weather/current?lat=${activeCity.lat}&lon=${activeCity.lon}`);
      if (res.ok) {
        const data = await res.json();
        return {
          location: `${activeCity.name}, ${activeCity.country || ""}`.trim(),
          temp: data.current.temp,
          condition: data.current.description,
          humidity: data.current.humidity,
          wind: data.current.wind_speed,
          uv: data.current.uv_index,
          rainChance: data.daily?.[0]?.pop ?? 0,
          hourly: (data.hourly ?? []).slice(0, 8).map((h: any) => ({
            time: h.time,
            temp: Math.round(h.temp),
            condition: h.description,
            pop: h.pop ?? 0,
          })),
          daily: (data.daily ?? []).slice(0, 7).map((d: any) => ({
            day: d.day_of_week,
            temp_min: Math.round(d.temp_min),
            temp_max: Math.round(d.temp_max),
            condition: d.description,
            pop: d.pop ?? 0,
          })),
        };
      }
    } catch (err) {
      console.error("Failed to fetch weather context for chat:", err);
    }
    return null;
  };

  // ── Send Message ───────────────────────────────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    if (!textToSend) setInput("");
    setIsLoading(true);
    setSuggestedCity(null); // Clear previous suggestions on new message

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // 1. Resolve active weather context
      let weatherContext = null;
      if (activeCity) {
        weatherContext = await fetchActiveWeatherContext();
      }

      if (!weatherContext) {
        // Fallback context if API is down
        weatherContext = {
          location: activeCity?.name || "Unknown location",
          temp: 20,
          condition: "Mild",
          humidity: 50,
          wind: 10,
        };
      }

      // 2. Request chat response from route
      const res = await fetch("/api/weather/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
          weather: weatherContext,
        }),
      });

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "I'm sorry, I encountered a connection issue. Please verify your OpenRouter key is set and active, then try again." },
        ]);
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.suggestedCity) {
        setSuggestedCity(data.suggestedCity);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm sorry, I encountered a connection issue. Please verify your OpenRouter key is set and active, then try again." },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const suggestions = [
    "Can I go for a walk now?",
    "What should I wear?",
    "Should I bring an umbrella?",
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* ── Chat Window ── */}
      {isOpen && (
        <div className="mb-4 w-[360px] h-[480px] rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden dark:border-slate-800 dark:bg-slate-950/95 backdrop-blur-md animate-fade-in animate-duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-400 to-blue-500 px-5 py-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5 text-white">
              <Bot className="h-5 w-5" />
              <div>
                <h4 className="text-sm font-bold leading-tight">Weatherly Assistant</h4>
                <p className="text-[10px] text-sky-100 font-medium leading-none mt-0.5">
                  {activeCity ? `Tuned to: ${activeCity.name}` : "Detecting active city..."}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-2 max-w-[85%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white",
                    msg.role === "user"
                      ? "bg-sky-500"
                      : "bg-gradient-to-br from-sky-400 to-blue-500"
                  )}
                >
                  {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm",
                    msg.role === "user"
                      ? "bg-sky-500 text-white rounded-tr-none"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 rounded-tl-none border border-slate-200/40 dark:border-slate-800/30"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 text-white">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="bg-slate-100 rounded-2xl px-4 py-2.5 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400 rounded-tl-none border border-slate-200/40 dark:border-slate-800/30 flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested City switcher banner */}
          {suggestedCity && !isLoading && (
            <div className="px-4 py-2 bg-sky-50 dark:bg-sky-950/20 border-t border-slate-100 dark:border-slate-900 flex items-center justify-between gap-2">
              <span className="text-[10px] text-sky-850 dark:text-sky-300 font-semibold line-clamp-1">
                Detected: {suggestedCity.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("weatherly:select_city", { detail: suggestedCity }));
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: `Switching dashboard to ${suggestedCity.name}.` }
                  ]);
                  setSuggestedCity(null);
                }}
                className="px-2.5 py-1 text-[10px] font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg active:scale-95 transition-all cursor-pointer shrink-0"
              >
                Switch Dashboard
              </button>
            </div>
          )}

          {/* Quick Suggestions (only shown when not loading) */}
          {!isLoading && messages.length <= 2 && (
            <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/50">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(sug)}
                  className="px-2.5 py-1 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input Form */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800 px-3 py-1.5 focus-within:border-sky-500/50 transition-colors"
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about weather, workouts..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 px-2 py-1 text-xs text-slate-950 placeholder-slate-450 dark:text-white dark:placeholder-slate-500 focus:outline-none focus:ring-0"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="h-8 w-8 flex items-center justify-center bg-sky-500 text-white rounded-xl hover:bg-sky-600 disabled:opacity-40 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Trigger Button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 text-white shadow-2xl hover:opacity-90 active:scale-95 transition-all shadow-blue-500/20 cursor-pointer border border-sky-300/10"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>
    </div>
  );
}
