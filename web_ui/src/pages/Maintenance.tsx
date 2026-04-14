import { useEffect, useState } from "react";
import { Wrench, Hourglass, AlertCircle, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const SARCASM_LINES = [
  "Our servers are taking a mindful break from your deadlines.",
  "We are improving things you were about to complain about.",
  "The hamsters powering production requested overtime pay.",
  "Maintenance mode: because 'ship now, fix later' had consequences.",
  "We are replacing duct tape with slightly better duct tape.",
  "If this page had a leaderboard, patience would be rank one.",
  "We found a bug that thought it was a feature.",
  "The platform is in surgery. Scalpel. Logs. Coffee.",
  "Your refresh key is working. We admire the optimism.",
  "We are tuning performance so your procrastination loads faster.",
  "The backend is reading the docs it ignored earlier.",
  "Yes, we tried turning it off and on. Twice.",
  "Everything is under control, except the timeline.",
  "This outage is sponsored by technical debt repayment.",
  "We will be back before your group project gets organized.",
];

const JOKE_INTERVAL_MS = 3800;
const FADE_MS = 380;
const THEME_STORAGE_KEY = "skola-maintenance-theme";

export default function MaintenancePage() {
  const [activeJoke, setActiveJoke] = useState(0);
  const [visible, setVisible] = useState(true);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark") {
      setIsDark(true);
      return;
    }
    if (savedTheme === "light") {
      setIsDark(false);
      return;
    }
    setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    let swapTimer: number | null = null;
    const interval = window.setInterval(() => {
      setVisible(false);
      if (swapTimer !== null) {
        window.clearTimeout(swapTimer);
      }
      swapTimer = window.setTimeout(() => {
        setActiveJoke((prev) => (prev + 1) % SARCASM_LINES.length);
        setVisible(true);
      }, FADE_MS);
    }, JOKE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      if (swapTimer !== null) {
        window.clearTimeout(swapTimer);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-hidden transition-colors duration-500",
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900",
      )}
    >
      <div
        className={cn(
          "maintenance-gradient-wave pointer-events-none absolute inset-[-18%]",
          isDark ? "maintenance-gradient-wave-dark" : "maintenance-gradient-wave-light",
        )}
      />
      <div
        className={cn(
          "maintenance-blob-a pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full blur-3xl",
          isDark ? "bg-indigo-400/25" : "bg-amber-300/45",
        )}
      />
      <div
        className={cn(
          "maintenance-blob-b pointer-events-none absolute -right-20 top-1/3 h-80 w-80 rounded-full blur-3xl",
          isDark ? "bg-cyan-400/20" : "bg-cyan-300/45",
        )}
      />
      <div
        className={cn(
          "maintenance-blob-c pointer-events-none absolute left-1/2 bottom-[-7rem] h-72 w-72 -translate-x-1/2 rounded-full blur-3xl",
          isDark ? "bg-fuchsia-400/15" : "bg-slate-300/55",
        )}
      />

      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 sm:px-8">
        <section
          className={cn(
            "w-full border p-6 shadow-2xl backdrop-blur-sm sm:p-10",
            isDark
              ? "border-slate-700/70 bg-slate-900/75 shadow-black/35"
              : "border-slate-200/80 bg-white/85 shadow-slate-900/10",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className={cn(
                "flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em]",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Maintenance Mode Enabled
            </div>
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
                isDark
                  ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {isDark ? "Light" : "Dark"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center border",
                isDark
                  ? "border-slate-600 bg-slate-800 text-slate-200"
                  : "border-slate-300 bg-slate-100 text-slate-700",
              )}
            >
              <Wrench className="h-5 w-5" />
            </div>
            <h1
              className={cn(
                "text-3xl font-black uppercase tracking-tight sm:text-4xl",
                isDark ? "text-slate-100" : "text-slate-900",
              )}
            >
              We&apos;ll Be Right Back
            </h1>
          </div>

          <p
            className={cn(
              "mt-4 max-w-2xl text-sm leading-relaxed sm:text-base",
              isDark ? "text-slate-300" : "text-slate-700",
            )}
          >
            The app is temporarily unavailable while we run scheduled maintenance. Every route is
            intentionally redirected here until maintenance mode is turned off.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto] md:items-stretch">
            <div
              className={cn(
                "border p-4 sm:p-5",
                isDark
                  ? "border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800"
                  : "border-slate-200 bg-gradient-to-r from-slate-50 to-white",
              )}
            >
              <div
                className={cn(
                  "mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]",
                  isDark ? "text-slate-400" : "text-slate-500",
                )}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Live Commentary
              </div>
              <p
                className={cn(
                  "min-h-[4.2rem] text-base font-semibold leading-relaxed transition-all duration-300 sm:text-lg",
                  isDark ? "text-slate-100" : "text-slate-800",
                  visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                )}
              >
                {SARCASM_LINES[activeJoke]}
              </p>
            </div>

            <div
              className={cn(
                "flex items-center justify-center border px-5 py-4 md:min-w-[11rem] md:flex-col md:gap-2",
                isDark
                  ? "border-slate-700 bg-slate-900"
                  : "border-slate-200 bg-slate-50",
              )}
            >
              <Hourglass className={cn("h-4 w-4", isDark ? "text-slate-300" : "text-slate-600")} />
              <span
                className={cn(
                  "ml-2 text-xs font-bold uppercase tracking-[0.2em] md:ml-0",
                  isDark ? "text-slate-300" : "text-slate-600",
                )}
              >
                Hold Tight
              </span>
            </div>
          </div>

          <p
            className={cn(
              "mt-6 text-[11px] uppercase tracking-[0.17em]",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            Status: service temporarily unavailable • Thank you for your patience
          </p>
        </section>
      </main>
    </div>
  );
}
