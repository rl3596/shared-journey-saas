import { NextResponse } from "next/server";
import { uploadImage } from "@/lib/storage";
import { createTimelineEvent, addTimelineComment } from "@/lib/data";

export async function POST(request: Request) {
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
  const location = String(form.get("location") ?? "").trim();
  const comment = String(form.get("comment") ?? "").trim();
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
    const event = await createTimelineEvent({ date, title, location, image });
    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Could not create milestone." },
        { status: 500 },
      );
    }
    // Seed the creator's (owner's) comment so the milestone starts with one
    // comment box bearing their name.
    await addTimelineComment(event.id, comment);
    return NextResponse.json({ ok: true, event });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
