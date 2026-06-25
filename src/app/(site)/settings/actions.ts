"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getSpaceContext, ACTIVE_SPACE_COOKIE } from "@/lib/space";
import { uploadImage } from "@/lib/storage";

type ActionResult = { ok: true } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Update the active space's name and anniversary date. */
export async function updateSpace(input: {
  name: string;
  anniversaryDate: string; // YYYY-MM-DD or ""
}): Promise<ActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { ok: false, error: "Not authenticated." };
  return updateSpaceById(ctx.spaceId, input);
}

/** Update any space the caller belongs to (RLS enforces membership). */
export async function updateSpaceById(
  spaceId: string,
  input: { name: string; anniversaryDate: string },
): Promise<ActionResult> {
  if (!UUID_RE.test(spaceId)) return { ok: false, error: "Invalid space." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const name = input.name.trim();
  if (name === "") return { ok: false, error: "Space name cannot be empty." };
  const anniversary = input.anniversaryDate.trim();

  const { error } = await supabase
    .from("spaces")
    .update({
      name,
      anniversary_date: anniversary === "" ? null : anniversary,
    })
    .eq("id", spaceId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Permanently delete a space and all its content. Owner-only. Uses the
 * service-role client (spaces has no DELETE policy) after verifying the caller
 * owns it. Refuses to delete the caller's only space, and clears the
 * active-space cookie when the deleted space was active.
 */
export async function deleteSpace(spaceId: string): Promise<ActionResult> {
  if (!UUID_RE.test(spaceId)) return { ok: false, error: "Invalid space." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", spaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Space not found." };
  if (membership.role !== "owner") {
    return { ok: false, error: "Only the owner can delete this space." };
  }

  const { count } = await supabase
    .from("space_members")
    .select("space_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) <= 1) {
    return {
      ok: false,
      error: "You can't delete your only space — create another first.",
    };
  }

  const svc = getServiceClient();
  const { error } = await svc.from("spaces").delete().eq("id", spaceId);
  if (error) return { ok: false, error: error.message };

  const jar = await cookies();
  if (jar.get(ACTIVE_SPACE_COOKIE)?.value === spaceId) {
    jar.delete(ACTIVE_SPACE_COOKIE);
  }

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
