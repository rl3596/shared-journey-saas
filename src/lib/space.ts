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
  anniversaryDate: string | null;
};

/** A member of a space, with the profile bits needed to render them. */
export type SpaceMemberProfile = {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
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
      return {
        id: s.id,
        name: s.name,
        role: r.role,
        anniversaryDate: s.anniversary_date,
      };
    });
}

/**
 * Members of a space the signed-in user belongs to, with profile info, sorted
 * owner-first then by name. Returns [] if the caller isn't a member (RLS would
 * also block the read, but we guard explicitly). Profiles are readable because
 * co-members satisfy shares_space_with().
 */
export async function getSpaceMembers(
  spaceId: string,
): Promise<SpaceMemberProfile[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: members } = await supabase
    .from("space_members")
    .select("user_id, role")
    .eq("space_id", spaceId);
  if (!members || !members.some((m) => m.user_id === user.id)) return [];

  const ids = members.map((m) => m.user_id as string);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, handle, avatar_url")
    .in("id", ids);

  const profById = new Map<string, Record<string, unknown>>();
  for (const p of profs ?? []) profById.set(p.id as string, p);

  const nameOf = (p: Record<string, unknown> | undefined): string => {
    if (!p) return "Member";
    const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    return (full || (p.username as string) ||
      (p.handle ? `@${p.handle}` : "Member")) as string;
  };

  return members
    .map((m) => {
      const p = profById.get(m.user_id as string);
      return {
        id: m.user_id as string,
        name: nameOf(p),
        handle: (p?.handle as string) ?? null,
        avatarUrl: (p?.avatar_url as string) ?? null,
        role: m.role as string,
      };
    })
    .sort((a, b) =>
      a.role === b.role
        ? a.name.localeCompare(b.name)
        : a.role === "owner"
          ? -1
          : 1,
    );
}
