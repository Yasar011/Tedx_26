"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";

const INTRO_SEEN_KEY = "tedx-intro-seen";
const HOLD_MS = 1500;
const FADE_MS = 600;

/**
 * Branded intro shown over the landing page on first visit.
 *
 * Deliberately once per session: an intro that replays on every navigation
 * stops being a flourish and starts being a delay. It also self-dismisses
 * on a timer rather than waiting on data, so it can never strand someone
 * on a splash screen, and is skipped entirely under reduced-motion.
 */
export function IntroLoader() {
  const [phase, setPhase] = useState<"hidden" | "showing" | "leaving">("hidden");

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
    } catch {
      // Private mode / blocked storage — just show it.
    }

    if (prefersReduced || alreadySeen) return;

    setPhase("showing");
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      /* non-fatal */
    }

    const leave = window.setTimeout(() => setPhase("leaving"), HOLD_MS);
    const done = window.setTimeout(() => setPhase("hidden"), HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950 transition-opacity duration-[600ms] ease-out"
      style={{ opacity: phase === "leaving" ? 0 : 1 }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-glow absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#EB0028]/25 blur-[120px]" />
      </div>

      <div className="relative flex flex-col items-center">
        <div className="animate-fade-up rounded-xl bg-white px-6 py-4">
          <Logo priority className="h-10 w-auto" />
        </div>

        {/* Loading bar that fills across the hold. */}
        <div className="mt-7 h-[3px] w-40 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-[#EB0028]"
            style={{
              animation: `tedx-intro-bar ${HOLD_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
            }}
          />
        </div>

        <p
          className="animate-fade-in mt-5 text-[11px] font-semibold uppercase tracking-[0.35em] text-neutral-500"
          style={{ animationDelay: "250ms" }}
        >
          Ideas worth spreading
        </p>
      </div>

      <style jsx>{`
        @keyframes tedx-intro-bar {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
