/** Hard ceiling for a stored applicant photo. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

/** Passport photos are portrait; this keeps them crisp without being huge. */
const MAX_EDGE_PX = 1000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Shrinks a photo in the browser before upload.
 *
 * Phone cameras produce 2–5 MB files, so uploading the original would be
 * slow on campus wifi and would burn Cloudinary quota. This scales the
 * longest edge down and steps the JPEG quality until the result fits, so
 * the applicant never has to resize anything themselves.
 *
 * Returns the original file untouched if it is already small enough.
 */
export async function compressImage(
  file: File,
  maxBytes: number = MAX_PHOTO_BYTES
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG or PNG).");
  }
  if (file.size <= maxBytes && file.type === "image/jpeg") return file;

  const img = await loadImage(file);

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  // White matte, so PNGs with transparency don't come out with black edges.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
    const blob = await toBlob(canvas, quality);
    if (!blob) continue;
    if (blob.size <= maxBytes) {
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }
  }

  throw new Error(
    "That image is too large even after compressing. Please use a smaller photo."
  );
}
