import { Heart } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-slate-200/60 bg-white/40 backdrop-blur-md dark:border-slate-900/60 dark:bg-slate-950/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-sky-400 to-indigo-500 bg-clip-text text-transparent">
                Weatherly
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/55 dark:text-sky-400 border border-sky-100/50 dark:border-sky-900/20">
                v1.1.0
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              A production-minded weather intelligence dashboard powered by OpenWeatherMap API and AI-driven summary insights.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Developer
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Mishkatul Islam
              </span>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="https://github.com/MishkatIT"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 border border-slate-200/50 text-slate-600 hover:bg-sky-50 hover:text-sky-500 hover:border-sky-200 dark:bg-slate-900 dark:border-slate-800/40 dark:text-slate-400 dark:hover:bg-sky-950/40 dark:hover:text-sky-400 dark:hover:border-sky-900/50 transition-all duration-300 group"
                title="GitHub Profile"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 group-hover:scale-110 transition-transform"
                >
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
              </a>

              <a
                href="https://linkedin.com/in/miskat141"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 border border-slate-200/50 text-slate-600 hover:bg-sky-50 hover:text-sky-500 hover:border-sky-200 dark:bg-slate-900 dark:border-slate-800/40 dark:text-slate-400 dark:hover:bg-sky-950/40 dark:hover:text-sky-400 dark:hover:border-sky-900/50 transition-all duration-300 group"
                title="LinkedIn Profile"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 group-hover:scale-110 transition-transform"
                >
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            &copy; {currentYear} Weatherly. All rights reserved.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
            Built with <Heart className="h-3.5 w-3.5 text-red-500 fill-current animate-pulse" /> by{" "}
            <a
              href="https://github.com/MishkatIT"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-600 hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-400 underline decoration-dotted underline-offset-4 decoration-slate-300 dark:decoration-slate-800"
            >
              MishkatIT
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
