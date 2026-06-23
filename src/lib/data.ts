import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabase } from "./supabase";
import { deleteImagesByUrl } from "./storage";
import { timelineEvents as mockTimeline } from "@/data/love-journey";
import { albums as mockAlbums } from "@/data/gallery";
import { scheduleEvents as mockSchedule } from "@/data/schedule";
import type { TimelineEvent } from "@/data/love-journey";
import type { Album, AlbumSummary } from "@/data/gallery";
import type { EventOwner, ScheduleEvent } from "@/data/schedule";

export type { TimelineEvent, Album, AlbumSummary, ScheduleEvent, EventOwner };

// Translate legacy owner values so old rows still render after the Me/Her → Rui/Wanyun rename.
function normalizeOwner(owner: string): EventOwner {
  if (owner === "Me") return "Rui";
  if (owner === "Her") return "Wanyun";
  return owner as EventOwner;
}

// Parse a (possibly free-form) date like "August 19, 2024" or "2024-08-19" to a sortable number.
function parsedTime(date: string): number {
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// ---------- Timeline ----------

export async function getTimelineEvents(): Promise<TimelineEvent[]> {
  const supabase = getSupabase();
  if (!supabase) return mockTimeline;

  const { data, error } = await supabase
    .from("timeline_events")
    .select("id,date,title,content_rui,content_wanyun,location,image");

  if (error || !data) {
    console.error("[data] timeline_events:", error?.message);
    return mockTimeline;
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
  // Chronological order even when the stored dates are free-form strings.
  events.sort((a, b) => parsedTime(a.date) - parsedTime(b.date));
  return events;
}

export async function createTimelineEvent(
  input: Omit<TimelineEvent, "id">,
): Promise<TimelineEvent | null> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const event: TimelineEvent = { id: randomUUID(), ...input };
  const { error } = await supabase.from("timeline_events").insert({
    id: event.id,
    date: event.date,
    title: event.title,
    content_rui: event.contentRui,
    content_wanyun: event.contentWanyun,
    // Legacy column kept by the dual-perspective migration with its
    // original NOT NULL constraint still in effect. Mirror contentRui
    // into it so inserts succeed even without dropping the constraint.
    description: event.contentRui,
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
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: existing } = await supabase
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
    // Keep the legacy description column in sync — it still has NOT NULL.
    description: fields.contentRui,
    location: fields.location,
  };
  if (fields.image !== undefined) patch.image = fields.image;

  const { error } = await supabase
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
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: existing } = await supabase
    .from("timeline_events")
    .select("image")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("timeline_events").delete().eq("id", id);
  if (error) {
    console.error("[data] deleteTimelineEvent:", error.message);
    return false;
  }
  if (existing?.image) await deleteImagesByUrl([existing.image]);
  return true;
}

// ---------- Albums / Photos ----------

export async function getAlbums(): Promise<AlbumSummary[]> {
  const supabase = getSupabase();
  if (!supabase) return mockAlbums.map(albumToSummary);

  const { data, error } = await supabase
    .from("albums")
    .select(
      "id,title,location,date,end_date,cover_image_url,pinned_at,image_urls,latitude,longitude",
    )
    // Pinned albums (pinned_at IS NOT NULL) come first, ordered by pin
    // time desc; then everything else ordered by date desc.
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("date", { ascending: false });

  if (error || !data) {
    console.error("[data] albums:", error?.message);
    return mockAlbums.map(albumToSummary);
  }

  // Trim every row down to its cover + photo count before sending to the
  // client. The browser never receives the full URL arrays from the list
  // payload, so it can't kick off downloads for photos the user hasn't
  // asked to see yet.
  return data.map((row) => {
    const urls = (row.image_urls ?? []) as string[];
    // Prefer the explicit cover_image_url; fall back to the first photo
    // for rows that pre-date the cover migration (or have a stale cover
    // pointing at a deleted URL).
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
      pinnedAt:
        typeof row.pinned_at === "string" ? row.pinned_at : undefined,
      latitude: typeof row.latitude === "number" ? row.latitude : undefined,
      longitude: typeof row.longitude === "number" ? row.longitude : undefined,
    };
  });
}

function albumToSummary(a: Album): AlbumSummary {
  return {
    id: a.id,
    title: a.title,
    location: a.location,
    date: a.date,
    endDate: a.endDate,
    cover: a.imageUrls[0],
    photoCount: a.imageUrls.length,
    latitude: a.latitude,
    longitude: a.longitude,
  };
}

/**
 * Flat list of every photo URL across every album. Used by the Home page's
 * daily slideshow to draw a deterministic random sample of 20.
 */
export async function getAllPhotos(): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return mockAlbums.flatMap((a) => a.imageUrls);

  const { data, error } = await supabase.from("albums").select("image_urls");
  if (error || !data) {
    console.error("[data] getAllPhotos:", error?.message);
    return [];
  }
  return data.flatMap((row) => (row.image_urls ?? []) as string[]);
}

/**
 * Fetch just the photo URL array for one album. Called on demand when the
 * user opens an album, so we don't pay the bandwidth cost up front.
 * Returns null if the album doesn't exist.
 */
export async function getAlbumPhotos(id: string): Promise<string[] | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return mockAlbums.find((a) => a.id === id)?.imageUrls ?? null;
  }
  const { data, error } = await supabase
    .from("albums")
    .select("image_urls")
    .eq("id", id)
    .single();
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
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const album: Album = { id: randomUUID(), ...input };
  const { error } = await supabase.from("albums").insert({
    id: album.id,
    title: album.title,
    location: album.location,
    date: album.date,
    end_date: album.endDate ?? null,
    // Default the cover to the first uploaded photo. The owner can override
    // it later via the edit-mode Star toggle.
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
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  // Use the append_album_image RPC instead of a JS-side read-modify-write.
  // The client uploads photos concurrently — without an atomic DB append,
  // two parallel POSTs would each read the same image_urls snapshot and
  // one would clobber the other, silently losing photos.
  for (const url of urls) {
    const { error } = await supabase.rpc("append_album_image", {
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
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
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
  // If the user deleted the photo that was the cover, repoint the cover
  // at whatever's still in the album (or null if it's now empty).
  const oldCover =
    typeof data.cover_image_url === "string" ? data.cover_image_url : null;
  const update: Record<string, unknown> = { image_urls: next };
  if (oldCover && toRemove.has(oldCover)) {
    update.cover_image_url = next[0] ?? null;
  }
  const { error: upErr } = await supabase
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

/**
 * Update an album's metadata. Only includes fields the caller provided so
 * partial updates (e.g. renaming an album from the edit-mode title input)
 * don't clobber other columns. `endDate: null` explicitly clears the
 * end-date column.
 */
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
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.date !== undefined) patch.date = fields.date;
  if (fields.endDate !== undefined) patch.end_date = fields.endDate; // null clears
  if (fields.coverImageUrl !== undefined) patch.cover_image_url = fields.coverImageUrl;
  if (fields.pinnedAt !== undefined) patch.pinned_at = fields.pinnedAt; // null unpins
  if (Object.keys(patch).length === 0) return true; // nothing to update

  const { error } = await supabase
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
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data } = await supabase
    .from("albums")
    .select("image_urls")
    .eq("id", albumId)
    .single();
  const urls = (data?.image_urls ?? []) as string[];

  const { error } = await supabase.from("albums").delete().eq("id", albumId);
  if (error) {
    console.error("[data] deleteAlbum:", error.message);
    return false;
  }
  if (urls.length > 0) await deleteImagesByUrl(urls); // remove photos from Storage
  return true;
}

// ---------- Schedule ----------

export async function getScheduleEvents(): Promise<ScheduleEvent[]> {
  // Hide past events: only return future + still-ongoing items (start time >= now).
  const now = Date.now();
  const isUpcoming = (e: ScheduleEvent) => {
    const t = new Date(`${e.date}T${e.time || "00:00"}`).getTime();
    return Number.isNaN(t) || t >= now;
  };

  const supabase = getSupabase();
  if (!supabase) return mockSchedule.filter(isUpcoming);

  const { data, error } = await supabase
    .from("schedule_events")
    .select("id,owner,title,date,time,notes")
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error || !data) {
    console.error("[data] schedule_events:", error?.message);
    return mockSchedule.filter(isUpcoming);
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
  const event: ScheduleEvent = { id: randomUUID(), ...input };

  const supabase = getSupabase();
  if (!supabase) return event;

  const { error } = await supabase.from("schedule_events").insert(event);
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
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const patch: Record<string, unknown> = {};
  if (fields.owner !== undefined) patch.owner = fields.owner;
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.date !== undefined) patch.date = fields.date;
  if (fields.time !== undefined) patch.time = fields.time;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  if (Object.keys(patch).length === 0) return true;

  const { error } = await supabase
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
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase
    .from("schedule_events")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[data] deleteScheduleEvent:", error.message);
    return false;
  }
  return true;
}

// ---------- Seed ----------

/** Upsert all mock data into Supabase. Used by the one-time /api/seed route. */
export async function seedFromMock(): Promise<{
  timeline: number;
  albums: number;
  schedule: number;
}> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const timelineRows = mockTimeline.map((e) => ({
    id: e.id,
    date: e.date,
    title: e.title,
    content_rui: e.contentRui,
    content_wanyun: e.contentWanyun,
    location: e.location,
    image: e.image ?? null,
  }));
  const albumRows = mockAlbums.map((a) => ({
    id: a.id,
    title: a.title,
    location: a.location,
    date: a.date,
    end_date: a.endDate ?? null,
    image_urls: a.imageUrls,
  }));
  const scheduleRows = mockSchedule.map((s) => ({ ...s }));

  const results = await Promise.all([
    supabase.from("timeline_events").upsert(timelineRows),
    supabase.from("albums").upsert(albumRows),
    supabase.from("schedule_events").upsert(scheduleRows),
  ]);

  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  return {
    timeline: timelineRows.length,
    albums: albumRows.length,
    schedule: scheduleRows.length,
  };
}
