/**
 * A crash caused by the app having been redeployed underneath the browser.
 *
 * Every build gives its JavaScript chunks new filenames. A tab opened
 * before a deploy — or a page restored from the back/forward cache — still
 * asks for the old ones, and the server no longer has them. The import
 * rejects, nothing catches it, and the whole route dies with a message
 * about a chunk, which says nothing to the person looking at it.
 *
 * Worth separating from a real bug: the code is fine, the browser is
 * merely holding a version that no longer exists, and fetching the current
 * one fixes it.
 */
export function isStaleBuildError(error: { name?: string; message?: string }): boolean {
  const text = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return (
    /ChunkLoadError/i.test(text) ||
    /Loading chunk \S+ failed/i.test(text) ||
    /Failed to load chunk/i.test(text) ||
    /Loading CSS chunk/i.test(text) ||
    /error loading dynamically imported module/i.test(text) ||
    /Importing a module script failed/i.test(text) ||
    /Failed to fetch dynamically imported module/i.test(text)
  );
}
