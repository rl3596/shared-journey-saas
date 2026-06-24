import "server-only";
import { getSpaceContext } from "@/lib/space";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  username: string | null;
  handle: string | null;
  firstName: string | null;
  lastName: string | null;
  location: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

/** Display name = "First Last" if set, else username, else @handle, else "Account". */
export function displayName(p: Profile | null): string {
  if (!p) return "Account";
  const full = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return full || p.username || (p.handle ? `@${p.handle}` : "Account");
}

const COLUMNS = "id, username, handle, first_name, last_name, location, bio, avatar_url";

function mapRow(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    username: (row.username as string) ?? null,
    handle: (row.handle as string) ?? null,
    firstName: (row.first_name as string) ?? null,
    lastName: (row.last_name as string) ?? null,
    location: (row.location as string) ?? null,
    bio: (row.bio as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
  };
}

/** The signed-in user's profile, or null when unauthenticated. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      id: user.id,
      username: null,
      handle: null,
      firstName: null,
      lastName: null,
      location: null,
      bio: null,
      avatarUrl: null,
    };
  }
  return mapRow(data);
}

// Re-export so callers needing the user id alongside the profile have it.
export { getSpaceContext };
