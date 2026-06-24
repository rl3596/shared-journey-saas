import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PendingInvitation = {
  id: string;
  spaceId: string;
  spaceName: string;
  inviterHandle: string | null;
  inviterName: string | null;
  createdAt: string;
};

/** Pending invitations addressed to the signed-in user (enriched via RPC). */
export async function getPendingInvitations(): Promise<PendingInvitation[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_pending_invitations");
  if (error || !data) {
    if (error) console.error("[invitations] pending:", error.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    spaceId: r.space_id as string,
    spaceName: r.space_name as string,
    inviterHandle: (r.inviter_handle as string) ?? null,
    inviterName: (r.inviter_name as string) ?? null,
    createdAt: r.created_at as string,
  }));
}
