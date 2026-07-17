"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CloudSun, Sun, Moon } from "lucide-react";

export default function Navbar() {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};

      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === "weatherly:theme") {
          onStoreChange();
        }
      };

      const observer = new MutationObserver(() => onStoreChange());
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      window.addEventListener("storage", handleStorageChange);

      return () => {
        observer.disconnect();
        window.removeEventListener("storage", handleStorageChange);
      };
    },
    () => {
      if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
        return "dark";
      }
      return "light";
    },
    () => "light"
  );

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("weatherly:theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 dark:border-slate-800/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 shadow-md shadow-blue-500/20">
            <CloudSun className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Weatherly</span>
            <span className="text-[10px] font-medium tracking-wide text-sky-500 dark:text-sky-400 uppercase leading-none">
              Powered by OpenWeather
            </span>
          </div>
        </Link>

        {/* Right side — theme toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-350 dark:hover:bg-slate-900/80 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            {theme === "dark" ? (
              <Sun className="h-4.5 w-4.5 text-amber-400" />
            ) : (
              <Moon className="h-4.5 w-4.5 text-indigo-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
