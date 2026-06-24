import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const ACTIVE_SPACE_COOKIE = "active_space_id";

export type Space = {
  id: string;
  name: string;
  anniversaryDate: string | null;
};

export type SpaceMembership = {
  id: string;
  name: string;
  role: string;
};

export type SpaceContext = {
  supabase: SupabaseClient;
  user: User;
  spaceId: string;
  space: Space;
};

type MemberRow = {
  space_id: string;
  role: string;
  spaces:
    | { id: string; name: string; anniversary_date: string | null }
    | { id: string; name: string; anniversary_date: string | null }[]
    | null;
};

function embed(row: MemberRow) {
  return (Array.isArray(row.spaces) ? row.spaces[0] : row.spaces) as {
    id: string;
    name: string;
    anniversary_date: string | null;
  };
}

/**
 * Resolve the signed-in user and their ACTIVE space. The active space is the
 * one named by the `active_space_id` cookie (set by the Space Switcher) when
 * the user is a member of it; otherwise it falls back to their earliest
 * membership. Returns null when there's no session or no memberships.
 *
 * The returned `supabase` is the RLS-scoped server client — use it for all
 * content reads/writes so the database enforces space isolation.
 */
export async function getSpaceContext(): Promise<SpaceContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("space_members")
    .select("space_id, role, spaces(id, name, anniversary_date)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) return null;

  const rows = data as MemberRow[];
  const preferred = (await cookies()).get(ACTIVE_SPACE_COOKIE)?.value;
  const chosen =
    rows.find((r) => r.space_id === preferred && r.spaces) ??
    rows.find((r) => r.spaces) ??
    null;
  if (!chosen) return null;

  const s = embed(chosen);
  return {
    supabase,
    user,
    spaceId: chosen.space_id,
    space: { id: s.id, name: s.name, anniversaryDate: s.anniversary_date },
  };
}

/** Like getSpaceContext but throws — convenient inside API routes / actions. */
export async function requireSpaceContext(): Promise<SpaceContext> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");
  return ctx;
}

/** All spaces the signed-in user belongs to (for the Space Switcher). */
export async function getUserSpaces(): Promise<SpaceMembership[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("space_members")
    .select("space_id, role, spaces(id, name, anniversary_date)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return ((data ?? []) as MemberRow[])
    .filter((r) => r.spaces)
    .map((r) => {
      const s = embed(r);
      return { id: s.id, name: s.name, role: r.role };
    });
}
