"use server";

import { revalidatePath } from "next/cache";
import {
  addTimelineComment,
  updateTimelineComment,
  deleteTimelineComment,
} from "@/lib/data";

type Result = { ok: true } | { ok: false; error: string };

export async function addComment(
  eventId: string,
  content: string,
): Promise<Result> {
  try {
    await addTimelineComment(eventId, content.trim());
    revalidatePath("/love-journey");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function editComment(
  commentId: string,
  content: string,
): Promise<Result> {
  try {
    await updateTimelineComment(commentId, content.trim());
    revalidatePath("/love-journey");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function removeComment(commentId: string): Promise<Result> {
  try {
    await deleteTimelineComment(commentId);
    revalidatePath("/love-journey");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
