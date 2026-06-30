"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

type SpaceActivity = {
  /** Member-space ids (other than the active one) with new, unseen notes. */
  unread: Set<string>;
  /** Mark a space as seen (called when the user switches into it). */
  clear: (spaceId: string) => void;
};

const Ctx = createContext<SpaceActivity>({ unread: new Set(), clear: () => {} });

export const useSpaceActivity = () => useContext(Ctx);

/**
 * Tracks live, cross-space note activity. Subscribes once to space_notes
 * INSERTs (no space filter — RLS delivers only the user's spaces). A new note
 * by someone else, in a space that isn't the active one, flags that space as
 * unread so the Space Switcher can show a red dot. Switching into a space
 * clears its flag. State is per-session (resets on a full reload).
 */
export function SpaceActivityProvider({
  activeSpaceId,
  currentUserId,
  children,
}: {
  activeSpaceId: string;
  currentUserId: string;
  children: ReactNode;
}) {
  const [unread, setUnread] = useState<Set<string>>(new Set());

  const clear = (spaceId: string) =>
    setUnread((prev) => {
      if (!prev.has(spaceId)) return prev;
      const next = new Set(prev);
      next.delete(spaceId);
      return next;
    });

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      supabase.realtime.setAuth(session?.access_token ?? null);

      channel = supabase
        .channel("space_notes:activity")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "space_notes" },
          (payload: { new: { space_id: string; author_id: string } }) => {
            const r = payload.new;
            if (r.author_id === currentUserId) return; // your own note
            if (r.space_id === activeSpaceId) return; // current space → notes board handles it
            setUnread((prev) =>
              prev.has(r.space_id) ? prev : new Set(prev).add(r.space_id),
            );
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeSpaceId, currentUserId]);

  return <Ctx.Provider value={{ unread, clear }}>{children}</Ctx.Provider>;
}
