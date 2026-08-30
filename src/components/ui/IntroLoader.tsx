"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";

const INTRO_SEEN_KEY = "tedx-intro-seen";
/** How long the sequence holds before it starts leaving. */
const HOLD_MS = 3000;
const EXIT_MS = 750;

/**
 * 3D branded intro shown over the landing page.
 *
 * Built on CSS 3D transforms rather than a WebGL library, so the public
 * entry point gains no JavaScript bundle weight: a perspective stage with
 * a receding floor grid, revolving rings lying on it, and the wordmark
 * flying in from depth and turning to face the viewer. On exit the camera
 * pushes *through* the splash into the page.
 *
 * Plays once per session — a 3s splash on every navigation would stop
 * being a flourish and start being a delay. It self-dismisses on a timer
 * rather than waiting on data, so it can never strand anyone, and is
 * skipped entirely under prefers-reduced-motion.
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
      // Private mode / blocked storage — just play it.
    }

    if (prefersReduced || alreadySeen) return;

    setPhase("showing");
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      /* non-fatal */
    }

    const leave = window.setTimeout(() => setPhase("leaving"), HOLD_MS);
    const done = window.setTimeout(() => setPhase("hidden"), HOLD_MS + EXIT_MS);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className={`intro-stage fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-neutral-950 ${
        phase === "leaving" ? "intro-leaving-3d" : ""
      }`}
    >
      {/* Receding stage floor — the horizon line of the 3D space. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 overflow-hidden"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="intro-floor absolute inset-0"
          style={{
            transform: "rotateX(76deg)",
            transformOrigin: "50% 0%",
            backgroundImage:
              "linear-gradient(to right, rgba(235,0,40,0.22) 1px, transparent 1px)," +
              "linear-gradient(to bottom, rgba(235,0,40,0.22) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 75%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 75%)",
          }}
        />
      </div>

      {/* A single ring easing outward on the floor plane. Needs its own
          perspective: CSS perspective only projects an element's DIRECT
          children, and this sits a level deeper than .intro-stage. One ring
          rather than several — a stack of them read as a radar sweep. */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ perspective: "900px" }}
      >
        <div
          className="intro-ring absolute h-[22rem] w-[22rem] rounded-full border border-[#EB0028]/35"
          style={{ animationDelay: "0.6s" }}
        />
      </div>

      {/* Warm core light behind the mark. */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[26rem] w-[26rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(235,0,40,0.38) 0%, rgba(235,0,40,0.10) 50%, transparent 72%)",
          filter: "blur(50px)",
        }}
      />

      <div
        className="relative flex flex-col items-center px-6"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="intro-logo-3d rounded-xl bg-white px-7 py-5 shadow-[0_25px_70px_-15px_rgba(235,0,40,0.75)]">
          <Logo priority className="h-11 w-auto sm:h-14" />
        </div>

        <p className="intro-tagline-3d mt-7 text-[10px] font-semibold uppercase tracking-[0.35em] text-neutral-400 sm:text-[11px]">
          Ideas worth spreading
        </p>
      </div>
    </div>
  );
}
