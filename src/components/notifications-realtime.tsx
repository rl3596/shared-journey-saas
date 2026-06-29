"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { NotificationType } from "@/lib/notifications";

const LABELS: Record<NotificationType, string> = {
  friend_request: "New friend request",
  friend_accepted: "Friend request accepted",
  friend_rejected: "Friend request declined",
  space_invite: "New space invitation",
  space_accepted: "Space invite accepted",
  space_rejected: "Space invite declined",
};

/**
 * Subscribes once (mounted in the site layout, not in the bell — which renders
 * twice for desktop/mobile) to realtime INSERTs on `notifications` for the
 * signed-in user. On a new row it pops a toast and calls router.refresh() so
 * the bell re-fetches the fully-enriched list (the realtime payload is the raw
 * row, without the joined sender name / space name) — the badge increments and
 * the new item appears at the top without a manual refresh.
 */
export default function NotificationsRealtime({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Authorize the realtime socket so RLS (user_id = auth.uid()) applies.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      supabase.realtime.setAuth(session?.access_token ?? null);

      channel = supabase
        .channel(`notifications:${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${currentUserId}`,
          },
          (payload) => {
            const row = payload.new as {
              type?: NotificationType;
              message?: string | null;
            };
            const title =
              (row.type && LABELS[row.type]) || "New notification";
            toast(title, {
              description: row.message || "Open the bell to see it.",
            });
            // Pull the enriched list (with sender/space names) + bump the badge.
            router.refresh();
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, router]);

  return null;
}
