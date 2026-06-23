import "server-only";
import { randomUUID } from "node:crypto";
import { getSpaceContext } from "@/lib/space";
import { deleteImagesByUrl } from "./storage";
import type { TimelineEvent } from "@/data/love-journey";
import type { Album, AlbumSummary } from "@/data/gallery";
import type { EventOwner, ScheduleEvent } from "@/data/schedule";

export type { TimelineEvent, Album, AlbumSummary, ScheduleEvent, EventOwner };

// Migrated rows may carry legacy owner labels; normalize for display.
function normalizeOwner(owner: string): EventOwner {
  if (owner === "Me") return "Rui";
  if (owner === "Her") return "Wanyun";
  return owner as EventOwner;
}

// Parse a (possibly free-form) date like "August 19, 2024" or "2024-08-19".
function parsedTime(date: string): number {
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// ---------- Timeline ----------

export async function getTimelineEvents(): Promise<TimelineEvent[]> {
  const ctx = await getSpaceContext();
  if (!ctx) return [];

  const { data, error } = await ctx.supabase
    .from("timeline_events")
    .select("id,date,title,content_rui,content_wanyun,location,image")
    .eq("space_id", ctx.spaceId);

  if (error || !data) {
    console.error("[data] timeline_events:", error?.message);
    return [];
  }

  const events: TimelineEvent[] = data.map((row) => ({
    id: row.id,
    date: row.date,
    title: row.title,
    contentRui: row.content_rui ?? "",
    contentWanyun: row.content_wanyun ?? "",
    location: row.location,
    image: row.image ?? undefined,
  }));
  events.sort((a, b) => parsedTime(a.date) - parsedTime(b.date));
  return events;
}

export async function createTimelineEvent(
  input: Omit<TimelineEvent, "id">,
): Promise<TimelineEvent | null> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  const event: TimelineEvent = { id: randomUUID(), ...input };
  const { error } = await ctx.supabase.from("timeline_events").insert({
    id: event.id,
    space_id: ctx.spaceId,
    date: event.date,
    title: event.title,
    content_rui: event.contentRui,
    content_wanyun: event.contentWanyun,
    location: event.location,
    image: event.image ?? null,
  });
  if (error) {
    console.error("[data] createTimelineEvent:", error.message);
    throw new Error(error.message);
  }
  return event;
}

export async function updateTimelineEvent(
  id: string,
  fields: {
    date: string;
    title: string;
    contentRui: string;
    contentWanyun: string;
    location: string;
    image?: string; // pass only when a new cover was uploaded
  },
): Promise<boolean> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  const { data: existing } = await ctx.supabase
    .from("timeline_events")
    .select("image")
    .eq("id", id)
    .single();
  const oldImage: string | null = existing?.image ?? null;

  const patch: Record<string, unknown> = {
    date: fields.date,
    title: fields.title,
    content_rui: fields.contentRui,
    content_wanyun: fields.contentWanyun,
    location: fields.location,
  };
  if (fields.image !== undefined) patch.image = fields.image;

  const { error } = await ctx.supabase
    .from("timeline_events")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[data] updateTimelineEvent:", error.message);
    throw new Error(error.message);
  }

  if (fields.image !== undefined && oldImage && oldImage !== fields.image) {
    await deleteImagesByUrl([oldImage]);
  }
  return true;
}

export async function deleteTimelineEvent(id: string): Promise<boolean> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  const { data: existing } = await ctx.supabase
    .from("timeline_events")
    .select("image")
    .eq("id", id)
    .single();

  const { error } = await ctx.supabase
    .from("timeline_events")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[data] deleteTimelineEvent:", error.message);
    return false;
  }
  if (existing?.image) await deleteImagesByUrl([existing.image]);
  return true;
}

// ---------- Albums / Photos ----------

export async function getAlbums(): Promise<AlbumSummary[]> {
  const ctx = await getSpaceContext();
  if (!ctx) return [];

  const { data, error } = await ctx.supabase
    .from("albums")
    .select(
      "id,title,location,date,end_date,cover_image_url,pinned_at,image_urls,latitude,longitude",
    )
    .eq("space_id", ctx.spaceId)
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("date", { ascending: false });

  if (error || !data) {
    console.error("[data] albums:", error?.message);
    return [];
  }

  return data.map((row) => {
    const urls = (row.image_urls ?? []) as string[];
    const explicit =
      typeof row.cover_image_url === "string" ? row.cover_image_url : null;
    const cover = explicit && urls.includes(explicit) ? explicit : urls[0];
    return {
      id: row.id,
      title: row.title,
      location: row.location,
      date: row.date,
      endDate: row.end_date ?? undefined,
      cover,
      photoCount: urls.length,
      pinnedAt: typeof row.pinned_at === "string" ? row.pinned_at : undefined,
      latitude: typeof row.latitude === "number" ? row.latitude : undefined,
      longitude: typeof row.longitude === "number" ? row.longitude : undefined,
    };
  });
}

/**
 * Flat list of every photo URL across the space's albums. Used by the Home
 * page's daily slideshow to draw a deterministic random sample.
 */
export async function getAllPhotos(): Promise<string[]> {
  const ctx = await getSpaceContext();
  if (!ctx) return [];

  const { data, error } = await ctx.supabase
    .from("albums")
    .select("image_urls")
    .eq("space_id", ctx.spaceId);
  if (error || !data) {
    console.error("[data] getAllPhotos:", error?.message);
    return [];
  }
  return data.flatMap((row) => (row.image_urls ?? []) as string[]);
}

/**
 * Fetch just the photo URL array for one album. Called on demand when the
 * user opens an album. RLS guarantees they can only read their space's albums.
 */
export async function getAlbumPhotos(id: string): Promise<string[] | null> {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { data, error } = await ctx.supabase
    .from("albums")
    .select("image_urls")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[data] getAlbumPhotos:", error.message);
    return null;
  }
  return (data.image_urls ?? []) as string[];
}

export async function createAlbum(input: {
  title: string;
  location: string;
  date: string;
  endDate?: string;
  imageUrls: string[];
  latitude?: number;
  longitude?: number;
}): Promise<Album | null> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  const album: Album = { id: randomUUID(), ...input };
  const { error } = await ctx.supabase.from("albums").insert({
    id: album.id,
    space_id: ctx.spaceId,
    title: album.title,
    location: album.location,
    date: album.date,
    end_date: album.endDate ?? null,
    cover_image_url: album.imageUrls[0] ?? null,
    image_urls: album.imageUrls,
    latitude: album.latitude ?? null,
    longitude: album.longitude ?? null,
  });
  if (error) {
    console.error("[data] createAlbum:", error.message);
    return null;
  }
  return album;
}

export async function addImagesToAlbum(
  albumId: string,
  urls: string[],
): Promise<boolean> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  // Atomic per-photo append (RLS-scoped). Avoids the read-modify-write race
  // when the client uploads photos concurrently.
  for (const url of urls) {
    const { error } = await ctx.supabase.rpc("append_album_image", {
      album_id: albumId,
      new_url: url,
    });
    if (error) {
      console.error("[data] append_album_image:", error.message);
      return false;
    }
  }
  return true;
}

export async function removeImagesFromAlbum(
  albumId: string,
  urls: string[],
): Promise<boolean> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  const { data, error } = await ctx.supabase
    .from("albums")
    .select("image_urls,cover_image_url")
    .eq("id", albumId)
    .single();
  if (error || !data) {
    console.error("[data] removeImagesFromAlbum select:", error?.message);
    return false;
  }

  const toRemove = new Set(urls);
  const next = ((data.image_urls ?? []) as string[]).filter(
    (u) => !toRemove.has(u),
  );
  const oldCover =
    typeof data.cover_image_url === "string" ? data.cover_image_url : null;
  const update: Record<string, unknown> = { image_urls: next };
  if (oldCover && toRemove.has(oldCover)) {
    update.cover_image_url = next[0] ?? null;
  }
  const { error: upErr } = await ctx.supabase
    .from("albums")
    .update(update)
    .eq("id", albumId);
  if (upErr) {
    console.error("[data] removeImagesFromAlbum update:", upErr.message);
    return false;
  }

  await deleteImagesByUrl(urls); // best-effort storage cleanup
  return true;
}

export async function updateAlbum(
  albumId: string,
  fields: {
    title?: string;
    date?: string;
    endDate?: string | null;
    coverImageUrl?: string | null;
    pinnedAt?: string | null;
  },
): Promise<boolean> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.date !== undefined) patch.date = fields.date;
  if (fields.endDate !== undefined) patch.end_date = fields.endDate;
  if (fields.coverImageUrl !== undefined)
    patch.cover_image_url = fields.coverImageUrl;
  if (fields.pinnedAt !== undefined) patch.pinned_at = fields.pinnedAt;
  if (Object.keys(patch).length === 0) return true;

  const { error } = await ctx.supabase
    .from("albums")
    .update(patch)
    .eq("id", albumId);
  if (error) {
    console.error("[data] updateAlbum:", error.message);
    return false;
  }
  return true;
}

export async function deleteAlbum(albumId: string): Promise<boolean> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  const { data } = await ctx.supabase
    .from("albums")
    .select("image_urls")
    .eq("id", albumId)
    .single();
  const urls = (data?.image_urls ?? []) as string[];

  const { error } = await ctx.supabase.from("albums").delete().eq("id", albumId);
  if (error) {
    console.error("[data] deleteAlbum:", error.message);
    return false;
  }
  if (urls.length > 0) await deleteImagesByUrl(urls);
  return true;
}

// ---------- Schedule ----------

export async function getScheduleEvents(): Promise<ScheduleEvent[]> {
  // Hide past events: only future + still-ongoing items (start time >= now).
  const now = Date.now();
  const isUpcoming = (e: ScheduleEvent) => {
    const t = new Date(`${e.date}T${e.time || "00:00"}`).getTime();
    return Number.isNaN(t) || t >= now;
  };

  const ctx = await getSpaceContext();
  if (!ctx) return [];

  const { data, error } = await ctx.supabase
    .from("schedule_events")
    .select("id,owner,title,date,time,notes")
    .eq("space_id", ctx.spaceId)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error || !data) {
    console.error("[data] schedule_events:", error?.message);
    return [];
  }

  return data
    .map((row) => ({
      id: row.id,
      owner: normalizeOwner(row.owner),
      title: row.title,
      date: row.date,
      time: row.time,
      notes: row.notes ?? "",
    }))
    .filter(isUpcoming);
}

export async function addScheduleEvent(
  input: Omit<ScheduleEvent, "id">,
): Promise<ScheduleEvent | null> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  const event: ScheduleEvent = { id: randomUUID(), ...input };
  const { error } = await ctx.supabase.from("schedule_events").insert({
    id: event.id,
    space_id: ctx.spaceId,
    owner: event.owner,
    title: event.title,
    date: event.date,
    time: event.time,
    notes: event.notes,
  });
  if (error) {
    console.error("[data] insert schedule_event:", error.message);
    return null;
  }
  return event;
}

export async function updateScheduleEvent(
  id: string,
  fields: {
    owner?: EventOwner;
    title?: string;
    date?: string;
    time?: string;
    notes?: string;
  },
): Promise<boolean> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  const patch: Record<string, unknown> = {};
  if (fields.owner !== undefined) patch.owner = fields.owner;
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.date !== undefined) patch.date = fields.date;
  if (fields.time !== undefined) patch.time = fields.time;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  if (Object.keys(patch).length === 0) return true;

  const { error } = await ctx.supabase
    .from("schedule_events")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[data] updateScheduleEvent:", error.message);
    return false;
  }
  return true;
}

export async function deleteScheduleEvent(id: string): Promise<boolean> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");

  const { error } = await ctx.supabase
    .from("schedule_events")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[data] deleteScheduleEvent:", error.message);
    return false;
  }
  return true;
}
