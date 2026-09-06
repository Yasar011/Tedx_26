"use client";

import { Button } from "./Button";

/**
 * Shown when a page's data couldn't be read.
 *
 * Firestore reads fail for ordinary reasons — a rule refusing the query, a
 * dropped connection, a missing index. A page that only handles the success
 * path leaves the organiser watching a spinner that never ends, with the
 * reason sitting in a console nobody has open.
 *
 * The message is shown verbatim rather than softened: "Missing or
 * insufficient permissions" tells whoever maintains the rules exactly where
 * to look, and a friendlier paraphrase would throw that away.
 */
export function LoadError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5">
      <p className="text-sm font-semibold text-red-800">{title}</p>
      <p className="mt-1 break-words font-mono text-xs text-red-700">{message}</p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
