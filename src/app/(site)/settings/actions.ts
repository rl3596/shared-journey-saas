"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getSpaceContext } from "@/lib/space";
import { uploadImage } from "@/lib/storage";

type ActionResult = { ok: true } | { ok: false; error: string };

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

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { ok: true };
}

/** Upload a custom background image; returns its public URL (stored client-side). */
export async function uploadBackground(
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
    const url = await uploadImage(file, "backgrounds");
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed." };
  }
}

/**
 * Permanently delete the signed-in user's account. Uses the service-role
 * admin API. Spaces where they're the only member are removed first (cascade
 * deletes that space's content); shared spaces are left intact.
 */
export async function deleteAccount(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const svc = getServiceClient();
  const { data: memberships } = await svc
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id);

  for (const m of memberships ?? []) {
    const { count } = await svc
      .from("space_members")
      .select("*", { count: "exact", head: true })
      .eq("space_id", m.space_id);
    if ((count ?? 0) <= 1) {
      await svc.from("spaces").delete().eq("id", m.space_id);
    }
  }

  const { error } = await svc.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
