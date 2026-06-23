import "server-only";
import { getSpaceContext } from "@/lib/space";

export type Profile = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
};

/** The signed-in user's profile, or null when unauthenticated. */
export async function getProfile(): Promise<Profile | null> {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("id", ctx.user.id)
    .maybeSingle();

  if (error || !data) {
    return { id: ctx.user.id, username: null, avatarUrl: null };
  }
  return {
    id: data.id,
    username: data.username ?? null,
    avatarUrl: data.avatar_url ?? null,
  };
}
