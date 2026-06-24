"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

export async function updateProfile(input: {
  username: string;
  handle: string;
  firstName: string;
  lastName: string;
  location: string;
  bio: string;
  avatarUrl: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const handle = input.handle.trim().toLowerCase();
  if (handle !== "" && !HANDLE_RE.test(handle)) {
    return {
      ok: false,
      error:
        "Handle must be 3–30 characters, lowercase letters, numbers, or underscores.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username: input.username.trim() || null,
      handle: handle || null,
      first_name: input.firstName.trim() || null,
      last_name: input.lastName.trim() || null,
      location: input.location.trim() || null,
      bio: input.bio.trim() || null,
      avatar_url: input.avatarUrl.trim() || null,
    })
    .eq("id", user.id);

  if (error) {
    // 23505 = unique_violation (handle already taken)
    if (error.code === "23505") {
      return { ok: false, error: "That handle is already taken." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout"); // refresh the sidebar user card
  revalidatePath("/profile");
  return { ok: true };
}
