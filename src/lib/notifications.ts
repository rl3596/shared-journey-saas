import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "friend_rejected"
  | "space_invite"
  | "space_accepted"
  | "space_rejected";

export type AppNotification = {
  id: string;
  type: NotificationType;
  referenceId: string | null;
  message: string | null;
  isRead: boolean;
  createdAt: string;
  senderId: string | null;
  senderHandle: string | null;
  senderName: string | null;
  senderAvatar: string | null;
  spaceName: string | null;
};

function mapRow(r: Record<string, unknown>): AppNotification {
  return {
    id: r.id as string,
    type: r.type as NotificationType,
    referenceId: (r.reference_id as string) ?? null,
    message: (r.message as string) ?? null,
    isRead: Boolean(r.is_read),
    createdAt: r.created_at as string,
    senderId: (r.sender_id as string) ?? null,
    senderHandle: (r.sender_handle as string) ?? null,
    senderName: (r.sender_name as string) ?? null,
    senderAvatar: (r.sender_avatar as string) ?? null,
    spaceName: (r.space_name as string) ?? null,
  };
}

/** The signed-in user's notifications (newest first), enriched via RPC. */
export async function getNotifications(): Promise<AppNotification[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_notifications");
  if (error || !data) {
    if (error) console.error("[notifications] list:", error.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map(mapRow);
}
