import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { uploadImage } from "@/lib/storage";
import { createAlbum } from "@/lib/data";
import { geocodeLocation } from "@/lib/geocode";

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart form data." },
      { status: 400 },
    );
  }

  const title = String(form.get("title") ?? "").trim();
  const date = String(form.get("date") ?? "").trim();
  const endDateRaw = String(form.get("end_date") ?? "").trim();
  // Only store an end_date when it's actually a multi-day event.
  const endDate = endDateRaw && endDateRaw !== date ? endDateRaw : undefined;
  const location = String(form.get("location") ?? "").trim();
  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  // Coords may come pre-resolved from the client (Nominatim picker). If not,
  // we'll fall back to geocoding the location string on the server below.
  let latitude: number | undefined;
  let longitude: number | undefined;
  const latStr = form.get("latitude");
  const lonStr = form.get("longitude");
  if (typeof latStr === "string" && typeof lonStr === "string") {
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      latitude = lat;
      longitude = lon;
    }
  }

  if (!title || !date) {
    return NextResponse.json(
      { ok: false, error: "Event name and date are required." },
      { status: 400 },
    );
  }

  try {
    const imageUrls: string[] = [];
    for (const file of files) {
      imageUrls.push(await uploadImage(file, "albums"));
    }

    // Server-side geocode fallback if the client didn't pre-resolve coordinates.
    if (latitude === undefined && location) {
      const coords = await geocodeLocation(location);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lon;
      }
    }

    const album = await createAlbum({
      title,
      location,
      date,
      endDate,
      imageUrls,
      latitude,
      longitude,
    });
    if (!album) {
      return NextResponse.json(
        { ok: false, error: "Could not create album." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, album });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
