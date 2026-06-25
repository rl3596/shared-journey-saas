import { NextResponse } from "next/server";
import { uploadImage } from "@/lib/storage";
import { updateTimelineEvent, deleteTimelineEvent } from "@/lib/data";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const date = String(form.get("date") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
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
    const ok = await updateTimelineEvent(id, {
      date,
      title,
      location,
      ...(image !== undefined ? { image } : {}),
    });
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Could not update milestone." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ok = await deleteTimelineEvent(id);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Could not delete milestone." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
