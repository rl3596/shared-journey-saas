"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

type Result = { ok: true } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pairFilter(a: string, b: string): string {
  return `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`;
}

/**
 * Invite an ACCEPTED FRIEND to a space the caller belongs to. Creates a
 * space_invite notification (reference_id = space_id); the recipient acts on it
 * from the bell. Guards: caller is a member of the space, target is an accepted
 * friend, not already a member, and no duplicate pending invite.
 */
export async function sendSpaceInvite(
  friendId: string,
  spaceId: string,
  message?: string,
): Promise<Result> {
  if (!UUID_RE.test(friendId) || !UUID_RE.test(spaceId)) {
    return { ok: false, error: "Invalid request." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (friendId === user.id) {
    return { ok: false, error: "You can't invite yourself." };
  }

  // Caller must belong to the target space.
  const { data: myMembership } = await supabase
    .from("space_members")
    .select("user_id")
    .eq("space_id", spaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!myMembership) {
    return { ok: false, error: "You're not in this space." };
  }

  // Must be an accepted friend.
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id, status")
    .or(pairFilter(user.id, friendId))
    .maybeSingle();
  if (!friendship || friendship.status !== "accepted") {
    return { ok: false, error: "You can only invite your friends." };
  }

  // Already a member of this space?
  const { data: existingMember } = await supabase
    .from("space_members")
    .select("user_id")
    .eq("space_id", spaceId)
    .eq("user_id", friendId)
    .maybeSingle();
  if (existingMember) {
    return { ok: false, error: "They're already in this space." };
  }

  // Outstanding invite already pending?
  const { data: dup } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", friendId)
    .eq("type", "space_invite")
    .eq("reference_id", spaceId)
    .eq("sender_id", user.id)
    .eq("is_read", false)
    .maybeSingle();
  if (dup) return { ok: false, error: "You've already invited them." };

  const { error } = await supabase.from("notifications").insert({
    user_id: friendId,
    sender_id: user.id,
    type: "space_invite",
    reference_id: spaceId,
    message: message?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Respond to a space_invite notification. Accepting adds you to space_members
 * (privileged service-role write, after validating the notification is yours)
 * and notifies the inviter; declining just notifies them. Either way the
 * invite notification is marked read.
 */
export async function respondSpaceInvite(
  notificationId: string,
  accept: boolean,
): Promise<Result> {
  if (!UUID_RE.test(notificationId)) {
    return { ok: false, error: "Invalid invitation." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: n } = await supabase
    .from("notifications")
    .select("id, type, reference_id, sender_id, user_id")
    .eq("id", notificationId)
    .maybeSingle();
  if (!n || n.user_id !== user.id || n.type !== "space_invite") {
    return { ok: false, error: "Invitation not found." };
  }
  const spaceId = n.reference_id as string;

  if (accept) {
    // space_members has no INSERT policy by design — perform the membership
    // write with the service role after the ownership check above.
    const svc = getServiceClient();
    const { error: memErr } = await svc.from("space_members").upsert(
      { space_id: spaceId, user_id: user.id, role: "member" },
      { onConflict: "space_id,user_id", ignoreDuplicates: true },
    );
    if (memErr) {
      return { ok: false, error: "That space is no longer available." };
    }
  }

  // Remove the invite notification — it's been acted on.
  await supabase.from("notifications").delete().eq("id", notificationId);

  if (n.sender_id) {
    await supabase.from("notifications").insert({
      user_id: n.sender_id,
      sender_id: user.id,
      type: accept ? "space_accepted" : "space_rejected",
      reference_id: spaceId,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
