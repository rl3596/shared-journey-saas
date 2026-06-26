"use server";

import { revalidatePath } from "next/cache";
import {
  addScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
} from "@/lib/data";

type Result = { ok: true } | { ok: false; error: string };

export async function createEvent(input: {
  title: string;
  date: string;
  time: string;
  timezone: string;
  notes: string;
  participantIds: string[];
}): Promise<Result> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (!input.date) return { ok: false, error: "Date is required." };
  try {
    await addScheduleEvent({
      title,
      date: input.date,
      time: input.time,
      timezone: input.timezone,
      notes: input.notes.trim(),
      participantIds: input.participantIds,
    });
    revalidatePath("/schedule");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function updateEvent(
  id: string,
  fields: {
    title?: string;
    date?: string;
    time?: string;
    timezone?: string;
    notes?: string;
    participantIds?: string[];
  },
): Promise<Result> {
  try {
    await updateScheduleEvent(id, fields);
    revalidatePath("/schedule");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function deleteEvent(id: string): Promise<Result> {
  try {
    await deleteScheduleEvent(id);
    revalidatePath("/schedule");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
