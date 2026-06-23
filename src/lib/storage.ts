import "server-only";
import { randomUUID } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/service";

export const STORAGE_BUCKET = "gallery";

const PUBLIC_MARKER = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

/**
 * Upload an image File to Supabase Storage and return its public URL.
 * Uses the service-role client: uploads are server-side only (called from
 * authenticated API routes), and Storage isn't governed by the table RLS.
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const supabase = getServiceClient();

  const dot = file.name.lastIndexOf(".");
  const ext = dot > -1 ? file.name.slice(dot + 1).toLowerCase() : "jpg";
  const path = `${folder}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Best-effort deletion of storage objects given their public URLs.
 * URLs that don't point at our bucket (e.g. seeded picsum links) are ignored.
 */
export async function deleteImagesByUrl(urls: string[]): Promise<void> {
  const supabase = getServiceClient();

  const paths = urls
    .map((url) => {
      const i = url.indexOf(PUBLIC_MARKER);
      return i === -1
        ? null
        : decodeURIComponent(url.slice(i + PUBLIC_MARKER.length));
    })
    .filter((p): p is string => !!p);

  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  if (error) console.error("[storage] remove:", error.message);
}
