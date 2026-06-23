"use server";

import { revalidatePath } from "next/cache";
import { getSpaceContext } from "@/lib/space";

type ActionResult = { ok: true } | { ok: false; error: string };

/** Update the signed-in user's profile (username, avatar URL). */
export async function updateProfile(input: {
  username: string;
  avatarUrl: string;
}): Promise<ActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  const username = input.username.trim();
  if (username === "") return { ok: false, error: "Username cannot be empty." };
  const avatarUrl = input.avatarUrl.trim();

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ username, avatar_url: avatarUrl || null })
    .eq("id", ctx.user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

/** Update the active space's name and anniversary date. */
export async function updateSpace(input: {
  name: string;
  anniversaryDate: string; // YYYY-MM-DD or ""
}): Promise<ActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  const name = input.name.trim();
  if (name === "") return { ok: false, error: "Space name cannot be empty." };
  const anniversary = input.anniversaryDate.trim();

  const { error } = await ctx.supabase
    .from("spaces")
    .update({
      name,
      anniversary_date: anniversary === "" ? null : anniversary,
    })
    .eq("id", ctx.spaceId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}
