import { NextResponse } from "next/server";
import { deleteScheduleEvent, updateScheduleEvent } from "@/lib/data";
import type { EventOwner } from "@/data/schedule";

const OWNERS: EventOwner[] = ["Rui", "Wanyun", "Joint"];

// Edit an existing schedule event. Only fields present in the body are
// updated; everything else is left alone.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const fields: {
    owner?: EventOwner;
    title?: string;
    date?: string;
    time?: string;
    notes?: string;
  } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      return NextResponse.json(
        { ok: false, error: "Invalid title" },
        { status: 400 },
      );
    }
    const title = body.title.trim();
    if (title === "") {
      return NextResponse.json(
        { ok: false, error: "Title cannot be empty" },
        { status: 400 },
      );
    }
    fields.title = title;
  }
  if (body.owner !== undefined) {
    if (!OWNERS.includes(body.owner as EventOwner)) {
      return NextResponse.json(
        { ok: false, error: "Invalid owner" },
        { status: 400 },
      );
    }
    fields.owner = body.owner as EventOwner;
  }
  if (body.date !== undefined) {
    if (typeof body.date !== "string" || body.date.trim() === "") {
      return NextResponse.json(
        { ok: false, error: "Invalid date" },
        { status: 400 },
      );
    }
    fields.date = body.date;
  }
  if (body.time !== undefined) {
    if (typeof body.time !== "string") {
      return NextResponse.json(
        { ok: false, error: "Invalid time" },
        { status: 400 },
      );
    }
    fields.time = body.time;
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") {
      return NextResponse.json(
        { ok: false, error: "Invalid notes" },
        { status: 400 },
      );
    }
    fields.notes = body.notes.trim();
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nothing to update" },
      { status: 400 },
    );
  }

  try {
    const ok = await updateScheduleEvent(id, fields);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Could not update event" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Update failed",
      },
      { status: 500 },
    );
  }
}

// Delete a schedule event.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const ok = await deleteScheduleEvent(id);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Could not delete event" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Delete failed",
      },
      { status: 500 },
    );
  }
}
