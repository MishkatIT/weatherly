"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloudSun, Sprout, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("weatherly:theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("weatherly:theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const links = [
    { href: "/", label: "Weather Dashboard", icon: CloudSun },
    { href: "/farm", label: "Farm Analyzer", icon: Sprout },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 dark:border-slate-800/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo/Attribution */}
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 shadow-md shadow-blue-500/20">
            <CloudSun className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Weatherly</span>
            <span className="text-[10px] font-medium tracking-wide text-sky-500 dark:text-sky-400 uppercase leading-none">
              Powered by WeatherAI
            </span>
          </div>
        </Link>

        {/* Navigation and Theme Toggle Container */}
        <div className="flex items-center gap-4">
          {/* Navigation links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-slate-200/70 text-slate-950 dark:bg-slate-900 dark:text-white shadow-inner"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-900/50 dark:hover:text-white"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-sky-500 dark:text-sky-400" : "text-slate-500")} />
                  <span className="hidden sm:inline">{link.label}</span>
                  
                  {/* Active Underline Micro-animation */}
                  {isActive && (
                    <span className="absolute bottom-1.5 left-4 right-4 h-0.5 rounded-full bg-gradient-to-r from-sky-400 to-blue-500" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Vertical Divider */}
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

          {/* Theme Switcher Toggle */}
          {mounted ? (
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
          ) : (
            <div className="w-9 h-9" />
          )}
        </div>
      </div>
    </header>
  );
}
