import { NextResponse } from "next/server";
import { deleteAlbum, updateAlbum } from "@/lib/data";

// Update an album's metadata (currently just title) — used by the
// album-modal edit mode's "Done" save path.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { title?: unknown; date?: unknown; end_date?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected JSON body." },
      { status: 400 },
    );
  }

  const fields: { title?: string; date?: string; endDate?: string | null } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      return NextResponse.json(
        { ok: false, error: "Invalid title." },
        { status: 400 },
      );
    }
    const title = body.title.trim();
    if (title === "") {
      return NextResponse.json(
        { ok: false, error: "Album name cannot be empty." },
        { status: 400 },
      );
    }
    fields.title = title;
  }

  if (body.date !== undefined) {
    if (typeof body.date !== "string") {
      return NextResponse.json(
        { ok: false, error: "Invalid start date." },
        { status: 400 },
      );
    }
    const date = body.date.trim();
    if (date === "") {
      return NextResponse.json(
        { ok: false, error: "Start date cannot be empty." },
        { status: 400 },
      );
    }
    fields.date = date;
  }

  if (body.end_date !== undefined) {
    // null or empty string explicitly clears the end_date column.
    if (body.end_date === null || body.end_date === "") {
      fields.endDate = null;
    } else if (typeof body.end_date === "string") {
      fields.endDate = body.end_date.trim();
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid end date." },
        { status: 400 },
      );
    }
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nothing to update." },
      { status: 400 },
    );
  }

  const ok = await updateAlbum(id, fields);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Could not update the album." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

// Delete an entire album: its database row plus all of its photos in Storage.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ok = await deleteAlbum(id);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Could not delete the album." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
