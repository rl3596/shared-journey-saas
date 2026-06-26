"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/storage";

type Result = { ok: true } | { ok: false; error: string };

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

/**
 * Upload a new avatar image (already HEIC-converted + resized on the client)
 * to Storage, save its URL on the profile, and return the URL. The avatar
 * updates everywhere immediately (sidebar card, etc.) via revalidation.
 */
export async function uploadAvatar(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No image provided." };
  }

  try {
    const url = await uploadImage(file, "avatars");
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    revalidatePath("/profile");
    return { ok: true, url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Upload failed.",
    };
  }
}

export async function updateProfile(input: {
  username: string;
  handle: string;
  pronouns: string;
  links: string;
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
      pronouns: input.pronouns.trim() || null,
      links: input.links.trim() || null,
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
