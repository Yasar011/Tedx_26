import { auth } from "./firebase/client";
import { CLOUDINARY_LIMITS } from "./constants";

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  bytes: number;
  format: string;
}

/**
 * Campus wifi and mobile data drop requests regularly. A dropped request
 * surfaces from fetch() as a bare "Failed to fetch", which tells an
 * applicant nothing and has already cost at least one of them a
 * submission. Every request is retried a few times, and if it still can't
 * get through it fails with something a person can actually act on.
 */
const UPLOAD_ATTEMPTS = 3;
const RETRY_BASE_MS = 800;
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * A request that never reached the server: offline, DNS failure, a dropped
 * connection, a blocking extension, or our own timeout. Kept distinct from
 * a server rejection because the fallback account cannot help with it.
 */
class NetworkFailure extends Error {}

const NETWORK_MESSAGE =
  "Upload failed — we couldn't reach the upload server. Check your internet connection and try again. " +
  "If you're on a VPN, or using an ad blocker or privacy extension, turn it off for this page and retry.";

function isTransportError(err: unknown): boolean {
  // fetch() rejects with a TypeError when the request never completed.
  if (err instanceof TypeError) return true;
  // Our own timeout aborts the request; the name is stable across browsers
  // even where the thrown value isn't a DOMException.
  return (
    typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError"
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A fetch that survives a blip. Retries only what is worth retrying — a
 * request that never landed, or a server shedding load — and never a 4xx,
 * which is ours to fix and will fail identically next time.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
    if (attempt > 1) await delay(RETRY_BASE_MS * 2 ** (attempt - 2));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Upload server returned ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      if (!isTransportError(err)) throw err;
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  if (isTransportError(lastError)) throw new NetworkFailure(NETWORK_MESSAGE);
  throw lastError instanceof Error ? lastError : new Error("Upload failed");
}

function resourceTypeFor(file: File): "image" | "video" | "raw" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "raw";
}

export function validateFileSize(file: File): string | null {
  const type = resourceTypeFor(file);
  const max =
    type === "image"
      ? CLOUDINARY_LIMITS.maxImageBytes
      : type === "video"
      ? CLOUDINARY_LIMITS.maxVideoBytes
      : CLOUDINARY_LIMITS.maxRawBytes;
  if (file.size > max) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max for ${type} is ${(
      max /
      1024 /
      1024
    ).toFixed(0)} MB on the current plan.`;
  }
  return null;
}

async function requestSignature(folder: string, useFallback: boolean) {
  let idToken: string | undefined;
  try {
    // Refreshing an expired ID token is itself a network call, so it fails
    // the same way a flaky connection does.
    idToken = await auth.currentUser?.getIdToken();
  } catch {
    throw new NetworkFailure(NETWORK_MESSAGE);
  }
  if (!idToken) throw new Error("Not signed in");

  const res = await fetchWithRetry("/api/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ folder, useFallback }),
  });
  if (res.status === 401) {
    throw new Error("Your session has expired. Please sign in again and retry the upload.");
  }
  if (!res.ok) throw new Error(`Could not get upload signature (${res.status})`);
  return res.json() as Promise<{ signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string }>;
}

async function uploadWith(
  file: File,
  folder: string,
  useFallback: boolean
): Promise<CloudinaryUploadResult> {
  const { signature, timestamp, apiKey, cloudName, folder: signedFolder } = await requestSignature(
    folder,
    useFallback
  );
  const resourceType = resourceTypeFor(file);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", signedFolder);

  const res = await fetchWithRetry(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Upload failed (${res.status})`);
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType,
    bytes: data.bytes,
    format: data.format,
  };
}

/**
 * Uploads to the primary Cloudinary account; automatically retries on the
 * fallback account if the primary rejects the upload (e.g. free-tier
 * monthly credits exhausted).
 */
export async function uploadToCloudinary(file: File, folder: string): Promise<CloudinaryUploadResult> {
  const sizeError = validateFileSize(file);
  if (sizeError) throw new Error(sizeError);

  try {
    return await uploadWith(file, folder, false);
  } catch (primaryError) {
    // A request that never reached Cloudinary won't reach the fallback
    // account either — that's the applicant's connection, not our quota,
    // and retrying doubles the wait before they see a useful message.
    if (primaryError instanceof NetworkFailure) throw primaryError;
    try {
      return await uploadWith(file, folder, true);
    } catch {
      throw primaryError;
    }
  }
}
