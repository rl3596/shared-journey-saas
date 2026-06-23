import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type Space = {
  id: string;
  name: string;
  anniversaryDate: string | null;
};

export type SpaceContext = {
  supabase: SupabaseClient;
  user: User;
  spaceId: string;
  space: Space;
};

/**
 * Resolve the signed-in user and their active space in one call. Returns null
 * when there's no session. In Phase 1 each user belongs to exactly one space
 * (auto-provisioned on signup); we pick their earliest membership as "active".
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
    .select("space_id, spaces(id, name, anniversary_date)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.spaces) return null;

  // `spaces` is a to-one embed; supabase-js may type it as object | array.
  const raw = (Array.isArray(data.spaces) ? data.spaces[0] : data.spaces) as {
    id: string;
    name: string;
    anniversary_date: string | null;
  };

  return {
    supabase,
    user,
    spaceId: data.space_id as string,
    space: {
      id: raw.id,
      name: raw.name,
      anniversaryDate: raw.anniversary_date,
    },
  };
}

/** Like getSpaceContext but throws — convenient inside API routes / actions. */
export async function requireSpaceContext(): Promise<SpaceContext> {
  const ctx = await getSpaceContext();
  if (!ctx) throw new Error("Not authenticated.");
  return ctx;
}
