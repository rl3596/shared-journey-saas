import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { uploadImage } from "@/lib/storage";
import {
  addImagesToAlbum,
  getAlbumPhotos,
  removeImagesFromAlbum,
} from "@/lib/data";

// List photos for one album. Called on demand when the user opens an album,
// so the gallery list payload doesn't have to carry every URL up front.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  const { id } = await params;
  const urls = await getAlbumPhotos(id);
  if (urls === null) {
    return NextResponse.json(
      { ok: false, error: "Album not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, urls });
}

// Add photos to an existing album.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  const { id } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart form data." },
      { status: 400 },
    );
  }

  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No photos provided." },
      { status: 400 },
    );
  }

  try {
    const urls: string[] = [];
    for (const file of files) {
      urls.push(await uploadImage(file, "albums"));
    }
    const ok = await addImagesToAlbum(id, urls);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Could not add photos." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, added: urls.length, urls });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Delete selected photos from an album (body: { urls: string[] }).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  const { id } = await params;

  let body: { urls?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const urls = Array.isArray(body.urls)
    ? body.urls.filter((u): u is string => typeof u === "string")
    : [];
  if (urls.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No photo URLs provided." },
      { status: 400 },
    );
  }

  const ok = await removeImagesFromAlbum(id, urls);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Could not delete photos." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, removed: urls.length });
}
