"use client";

// Live Photos and other HEIC/HEIF files don't render in most browsers'
// <img> tags. Convert them to JPEG in the browser before upload so the
// stored file is something every device can display.

export function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif")) return true;
  const type = file.type.toLowerCase();
  return type === "image/heic" || type === "image/heif";
}

export async function convertHeicIfNeeded(file: File): Promise<File> {
  if (!isHeic(file)) return file;

  // Lazy-load heic2any so the ~250KB WASM bundle only ships to users who
  // actually pick a Live Photo / HEIC file (i.e. iPhone users on upload).
  const { default: heic2any } = await import("heic2any");

  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.85,
  });

  // heic2any returns Blob or Blob[] depending on how many images were inside.
  const blob = Array.isArray(converted) ? converted[0] : converted;

  const baseName = file.name.replace(/\.(heic|heif)$/i, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

// Vercel's serverless function body limit is 4.5 MB per request, and a single
// iPhone photo can easily exceed that. Downscale to a sensible max dimension
// so each upload fits comfortably under the limit. 2048 px on the long edge
// keeps photos crisp for gallery cards (~600 px) and the lightbox (~1600 px),
// while cutting file sizes 5–10×.
const SHRINK_MAX_DIMENSION = 2048;
const SHRINK_QUALITY = 0.85;
// Skip resizing files already small enough to spare phone CPU.
const SHRINK_THRESHOLD_BYTES = 1.5 * 1024 * 1024;

export async function shrinkIfNeeded(file: File): Promise<File> {
  if (file.size < SHRINK_THRESHOLD_BYTES) return file;
  if (!file.type.startsWith("image/")) return file;
  // GIFs lose animation through a canvas, SVGs don't benefit from raster
  // re-encoding — leave both alone.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // Decoding failed — let the upload try with the original.
  }

  const scale = Math.min(
    1,
    SHRINK_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  if (scale >= 1) {
    bitmap.close();
    return file;
  }
  const newW = Math.round(bitmap.width * scale);
  const newH = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, newW, newH);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", SHRINK_QUALITY);
  });
  if (!blob) return file;

  const baseName = file.name.replace(/\.\w+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

/**
 * Convert HEIC → JPEG if needed, then shrink large photos so each one fits
 * under Vercel's 4.5 MB serverless body limit. Use this everywhere photos
 * are uploaded.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const converted = await convertHeicIfNeeded(file);
  return shrinkIfNeeded(converted);
}
