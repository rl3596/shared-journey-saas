"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { ACTIVE_SPACE_COOKIE } from "@/lib/space";

type Result = { ok: true; id?: string } | { ok: false; error: string };

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
  sameSite: "lax" as const,
};

/** Switch the active space. Validates membership before setting the cookie. */
export async function setActiveSpace(spaceId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .maybeSingle();
  if (!data) return { ok: false, error: "You're not a member of that space." };

  (await cookies()).set(ACTIVE_SPACE_COOKIE, spaceId, COOKIE_OPTS);
  // Re-render every route so all data fetching picks up the new space.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Create a brand-new space and make the caller its owner, then switch to it.
 * Uses the service-role client because there's no broad "users can create
 * spaces" RLS policy — the action authenticates the user first and inserts
 * exactly one space owned by them.
 */
export async function createSpace(name: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const trimmed = name.trim();
  if (trimmed === "") return { ok: false, error: "Space name cannot be empty." };

  const svc = getServiceClient();
  const { data: space, error: insErr } = await svc
    .from("spaces")
    .insert({ name: trimmed })
    .select("id")
    .single();
  if (insErr || !space) {
    return { ok: false, error: insErr?.message ?? "Could not create space." };
  }

  const { error: memErr } = await svc
    .from("space_members")
    .insert({ space_id: space.id, user_id: user.id, role: "owner" });
  if (memErr) {
    // best-effort cleanup of the orphaned space
    await svc.from("spaces").delete().eq("id", space.id);
    return { ok: false, error: memErr.message };
  }

  (await cookies()).set(ACTIVE_SPACE_COOKIE, space.id as string, COOKIE_OPTS);
  revalidatePath("/", "layout");
  return { ok: true, id: space.id as string };
}
