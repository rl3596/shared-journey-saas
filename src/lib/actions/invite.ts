"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/space";

export type FoundUser = {
  id: string;
  handle: string | null;
  name: string | null;
  avatarUrl: string | null;
};

type Result = { ok: true } | { ok: false; error: string };

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
    .filter((r) => r.id !== user.id) // don't offer to invite yourself
    .map((r) => {
      const name =
        [r.first_name, r.last_name].filter(Boolean).join(" ").trim() ||
        (r.username as string) ||
        null;
      return {
        id: r.id as string,
        handle: (r.handle as string) ?? null,
        name,
        avatarUrl: (r.avatar_url as string) ?? null,
      };
    });
  return { ok: true, results };
}

/** Invite a user to the ACTIVE space. Resets any prior declined/expired invite. */
export async function sendInvite(inviteeId: string): Promise<Result> {
  const ctx = await getSpaceContext();
  if (!ctx) return { ok: false, error: "Not authenticated." };
  if (inviteeId === ctx.user.id) {
    return { ok: false, error: "You can't invite yourself." };
  }

  // Already a member of this space?
  const { data: existingMember } = await ctx.supabase
    .from("space_members")
    .select("user_id")
    .eq("space_id", ctx.spaceId)
    .eq("user_id", inviteeId)
    .maybeSingle();
  if (existingMember) {
    return { ok: false, error: "They're already in this space." };
  }

  // Clear any prior invite row (declined/stale) then create a fresh pending one.
  await ctx.supabase
    .from("space_invitations")
    .delete()
    .eq("space_id", ctx.spaceId)
    .eq("invitee_id", inviteeId);

  const { error } = await ctx.supabase.from("space_invitations").insert({
    space_id: ctx.spaceId,
    inviter_id: ctx.user.id,
    invitee_id: inviteeId,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

export async function acceptInvitation(invitationId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", {
    invitation_id: invitationId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function declineInvitation(invitationId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_invitation", {
    invitation_id: invitationId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
