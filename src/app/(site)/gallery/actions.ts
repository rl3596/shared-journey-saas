"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { updateAlbum } from "@/lib/data";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Persist the chosen photo as the album's cover. Called from the gallery
 * client component when the user taps the Star overlay in edit mode.
 * The client also updates its local state optimistically so the UI feels
 * instant — this action just brings the database in line.
 */
export async function setAlbumCover(
  albumId: string,
  imageUrl: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }
  if (typeof albumId !== "string" || albumId.trim() === "") {
    return { ok: false, error: "Missing album id." };
  }
  if (typeof imageUrl !== "string" || imageUrl.trim() === "") {
    return { ok: false, error: "Missing image URL." };
  }

  try {
    const ok = await updateAlbum(albumId, { coverImageUrl: imageUrl });
    if (!ok) return { ok: false, error: "Could not update the cover photo." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed.";
    return { ok: false, error: message };
  }

  // Refresh the gallery list (cards) and home page (recent memory) so the
  // new cover propagates without a manual reload.
  revalidatePath("/gallery");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Pin (or unpin) an album so it sits at the top of the gallery. `pin: true`
 * stamps pinned_at to now; `pin: false` clears it.
 */
export async function togglePinAlbum(
  albumId: string,
  pin: boolean,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }
  if (typeof albumId !== "string" || albumId.trim() === "") {
    return { ok: false, error: "Missing album id." };
  }

  try {
    const ok = await updateAlbum(albumId, {
      pinnedAt: pin ? new Date().toISOString() : null,
    });
    if (!ok) return { ok: false, error: "Could not update pin state." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed.";
    return { ok: false, error: message };
  }

  revalidatePath("/gallery");
  revalidatePath("/");
  return { ok: true };
}
