"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FoundUser = {
  id: string;
  handle: string | null;
  name: string | null;
  avatarUrl: string | null;
};

type Result = { ok: true } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PostgREST filter matching a friendship row for an unordered pair. */
function pairFilter(a: string, b: string): string {
  return `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`;
}

/** Find a user by EXACT @handle or email (secure RPC; no enumeration). */
export async function searchUser(query: string): Promise<{
  ok: boolean;
  results?: FoundUser[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const q = query.trim().replace(/^@/, "");
  if (q === "") return { ok: true, results: [] };

  const { data, error } = await supabase.rpc("search_profile", { query: q });
  if (error) return { ok: false, error: error.message };

  const results: FoundUser[] = (data as Record<string, unknown>[])
    .filter((r) => r.id !== user.id) // don't offer to add yourself
    .map((r) => {
      const name = (r.username as string)?.trim() || null;
      return {
        id: r.id as string,
        handle: (r.handle as string) ?? null,
        name,
        avatarUrl: (r.avatar_url as string) ?? null,
      };
    });
  return { ok: true, results };
}

/**
 * Send a friend request to `addresseeId` with an optional message. Reuses a
 * prior REJECTED row (so people can re-add after a decline); errors clearly if
 * they're already friends or a request is already in flight either way.
 */
export async function sendFriendRequest(
  addresseeId: string,
  message?: string,
): Promise<Result> {
  if (!UUID_RE.test(addresseeId)) {
    return { ok: false, error: "Invalid user." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (addresseeId === user.id) {
    return { ok: false, error: "You can't add yourself." };
  }

  const { data: existing } = await supabase
    .from("friendships")
    .select("id, requester_id, status")
    .or(pairFilter(user.id, addresseeId))
    .maybeSingle();

  let friendshipId: string;
  if (existing) {
    if (existing.status === "accepted") {
      return { ok: false, error: "You're already friends." };
    }
    if (existing.status === "pending") {
      return existing.requester_id === user.id
        ? { ok: false, error: "You've already sent them a request." }
        : {
            ok: false,
            error: "They already sent you a request — check your notifications.",
          };
    }
    // rejected → revive as a fresh outgoing request
    const { data: revived, error } = await supabase
      .from("friendships")
      .update({
        requester_id: user.id,
        addressee_id: addresseeId,
        status: "pending",
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error || !revived) {
      return { ok: false, error: error?.message ?? "Could not send request." };
    }
    friendshipId = revived.id;
  } else {
    const { data: created, error } = await supabase
      .from("friendships")
      .insert({
        requester_id: user.id,
        addressee_id: addresseeId,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, error: error?.message ?? "Could not send request." };
    }
    friendshipId = created.id;
  }

  const { error: nErr } = await supabase.from("notifications").insert({
    user_id: addresseeId,
    sender_id: user.id,
    type: "friend_request",
    reference_id: friendshipId,
    message: message?.trim() || null,
  });
  if (nErr) return { ok: false, error: nErr.message };

  revalidatePath("/friends");
  return { ok: true };
}

/**
 * Respond to a friend request you received. Accepting flips the friendship to
 * 'accepted'; declining to 'rejected'. Either way the original request
 * notification is marked read and a result notification is sent to the sender.
 */
export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean,
): Promise<Result> {
  if (!UUID_RE.test(friendshipId)) {
    return { ok: false, error: "Invalid request." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: f } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .eq("id", friendshipId)
    .maybeSingle();
  if (!f) return { ok: false, error: "Request not found." };
  if (f.addressee_id !== user.id) {
    return { ok: false, error: "You can't respond to this request." };
  }
  if (f.status !== "pending") {
    return { ok: false, error: "This request was already handled." };
  }

  const { error: upErr } = await supabase
    .from("friendships")
    .update({ status: accept ? "accepted" : "rejected" })
    .eq("id", friendshipId);
  if (upErr) return { ok: false, error: upErr.message };

  // Remove the request notification — it's been acted on, so it shouldn't
  // linger in the bell.
  await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id)
    .eq("type", "friend_request")
    .eq("reference_id", friendshipId);

  // Notify the requester of the outcome.
  await supabase.from("notifications").insert({
    user_id: f.requester_id,
    sender_id: user.id,
    type: accept ? "friend_accepted" : "friend_rejected",
    reference_id: friendshipId,
  });

  revalidatePath("/", "layout");
  revalidatePath("/friends");
  return { ok: true };
}
