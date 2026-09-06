"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { isStaleBuildError } from "@/lib/errors";

/** Suppresses a second automatic reload, so a chunk that is genuinely gone
 *  shows the error instead of reloading for ever. */
const RELOAD_MARKER = "tedx:last-stale-build-reload";
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * Without this, a crash anywhere in the app falls through to Next's own
 * screen: "This page couldn't load", a Reload button, and nothing about
 * what went wrong — a dead end for the organiser who hits it and for
 * whoever has to fix it afterwards, since the cause only ever existed in a
 * browser console nobody had open.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (!isStaleBuildError(error)) {
      console.error("Unhandled application error:", error);
      return;
    }
    // The build moved on while this tab was open. Fetching the current one
    // is the fix, so do it rather than making them work that out.
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RELOAD_MARKER) ?? 0);
    } catch {
      // Private mode can refuse storage; then the cooldown just doesn't apply.
    }
    if (Date.now() - last < RELOAD_COOLDOWN_MS) {
      console.error("Stale-build reload already attempted; showing the error:", error);
      return;
    }
    try {
      sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
    } catch {
      // As above — a failed write only costs us the loop guard.
    }
    setReloading(true);
    window.location.reload();
  }, [error]);

  if (reloading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <p className="text-sm text-neutral-500">Updating to the latest version…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-neutral-500">
          This page hit an error and couldn&apos;t finish loading. Trying again often works —
          if it doesn&apos;t, send the details below to whoever maintains the platform.
        </p>

        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Error</p>
          <p className="mt-1 break-words font-mono text-xs text-neutral-800">
            {error.message || "Unknown error"}
          </p>
          {error.digest && (
            <p className="mt-2 break-words font-mono text-[11px] text-neutral-500">
              digest: {error.digest}
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <Button className="flex-1" onClick={reset}>
            Try again
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
