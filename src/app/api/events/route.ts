import { NextResponse } from "next/server";
import { addScheduleEvent } from "@/lib/data";
import type { EventOwner } from "@/data/schedule";

const OWNERS: EventOwner[] = ["Rui", "Wanyun", "Joint"];

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const owner = OWNERS.includes(body.owner as EventOwner)
    ? (body.owner as EventOwner)
    : null;
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!title || !owner || !date) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (title, owner, date)." },
      { status: 400 },
    );
  }

  const event = await addScheduleEvent({ owner, title, date, time, notes });
  if (!event) {
    return NextResponse.json(
      { ok: false, error: "Could not save event" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, event });
}
