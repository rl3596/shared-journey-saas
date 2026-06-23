import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { uploadImage } from "@/lib/storage";
import { createTimelineEvent } from "@/lib/data";

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

  const date = String(form.get("date") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const contentRui = String(form.get("content_rui") ?? "").trim();
  const contentWanyun = String(form.get("content_wanyun") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const cover = form.get("cover");
  const coverFile = cover instanceof File && cover.size > 0 ? cover : null;

  if (!date || !title) {
    return NextResponse.json(
      { ok: false, error: "Date and title are required." },
      { status: 400 },
    );
  }

  try {
    const image = coverFile ? await uploadImage(coverFile, "timeline") : undefined;
    const event = await createTimelineEvent({
      date,
      title,
      contentRui,
      contentWanyun,
      location,
      image,
    });
    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Could not create milestone." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, event });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
