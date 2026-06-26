import "server-only";
import { createClient } from "@/lib/supabase/server";

export type FriendStatus = "pending" | "accepted" | "rejected";
export type FriendDirection = "incoming" | "outgoing";

/** One friendship I'm part of, from my perspective (the OTHER party's info). */
export type FriendLink = {
  friendshipId: string;
  otherId: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  location: string | null;
  bio: string | null;
  status: FriendStatus;
  direction: FriendDirection;
  createdAt: string;
};

/** A confirmed friend, ready to render in lists / invite pickers. */
export type Friend = {
  friendshipId: string;
  id: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
};

function mapRow(r: Record<string, unknown>): FriendLink {
  return {
    friendshipId: r.friendship_id as string,
    otherId: r.other_id as string,
    handle: (r.handle as string) ?? null,
    name: (r.name as string) ?? "Member",
    avatarUrl: (r.avatar_url as string) ?? null,
    location: (r.location as string) ?? null,
    bio: (r.bio as string) ?? null,
    status: r.status as FriendStatus,
    direction: r.direction as FriendDirection,
    createdAt: r.created_at as string,
  };
}

/** Every friendship link for the signed-in user (any status), enriched. */
export async function getFriendsOverview(): Promise<FriendLink[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_friends_overview");
  if (error || !data) {
    if (error) console.error("[friends] overview:", error.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map(mapRow);
}

/** Accepted friends only, sorted alphabetically by display name. */
export async function getAcceptedFriends(): Promise<Friend[]> {
  const links = await getFriendsOverview();
  return links
    .filter((l) => l.status === "accepted")
    .map((l) => ({
      friendshipId: l.friendshipId,
      id: l.otherId,
      handle: l.handle,
      name: l.name,
      avatarUrl: l.avatarUrl,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
