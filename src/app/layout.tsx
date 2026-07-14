import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/shared/Navbar";
import UsageWidget from "@/components/shared/UsageWidget";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Weatherly — Powered by WeatherAI",
  description:
    "Weatherly is a full-stack weather and environmental intelligence platform powered by the WeatherAI API. Features include auto weather detection, city weather dashboard, and farm canopy tree health analysis.",
  keywords: ["weather", "weatherly", "WeatherAI", "tree count", "agronomy", "canopy health"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased dark`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50 font-sans selection:bg-sky-500/30 selection:text-sky-200" suppressHydrationWarning>
        <Providers>
          <Navbar />
          <main className="flex-1 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <UsageWidget />
        </Providers>
      </body>
    </html>
  );
}
