import { auth } from "./firebase/client";
import { CLOUDINARY_LIMITS } from "./constants";

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  bytes: number;
  format: string;
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
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Not signed in");
  const res = await fetch("/api/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ folder, useFallback }),
  });
  if (!res.ok) throw new Error("Could not get upload signature");
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

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: formData,
  });

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
    try {
      return await uploadWith(file, folder, true);
    } catch {
      throw primaryError;
    }
  }
}
