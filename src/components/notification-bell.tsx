"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, Check, X, Loader2, UserPlus, Users } from "lucide-react";
import type { AppNotification, NotificationType } from "@/lib/notifications";
import { respondFriendRequest } from "@/lib/actions/friends";
import { respondSpaceInvite } from "@/lib/actions/invite";
import {
  dismissNotification,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";

function senderLabel(n: AppNotification): string {
  return n.senderName ?? (n.senderHandle ? `@${n.senderHandle}` : "Someone");
}

function initial(n: AppNotification): string {
  return (n.senderName?.[0] ?? n.senderHandle?.[0] ?? "·").toUpperCase();
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Result-only types just need a dismiss button. */
const RESULT_TYPES: NotificationType[] = [
  "friend_accepted",
  "friend_rejected",
  "space_accepted",
  "space_rejected",
];

function messageFor(n: AppNotification): React.ReactNode {
  const who = <span className="font-medium">{senderLabel(n)}</span>;
  const space = <span className="font-medium">{n.spaceName ?? "a space"}</span>;
  switch (n.type) {
    case "friend_request":
      return <>{who} sent you a friend request</>;
    case "friend_accepted":
      return <>{who} accepted your friend request</>;
    case "friend_rejected":
      return <>{who} declined your friend request</>;
    case "space_invite":
      return <>{who} invited you to {space}</>;
    case "space_accepted":
      return <>{who} joined {space}</>;
    case "space_rejected":
      return <>{who} declined to join {space}</>;
  }
}

export default function NotificationBell({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const unread = notifications.filter((n) => !n.isRead).length;

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    router.refresh();
    setBusyId(null);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Notifications
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => run("all", markAllNotificationsRead)}
                className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {notifications.map((n) => {
                const busy = busyId === n.id;
                const isResult = RESULT_TYPES.includes(n.type);
                return (
                  <li
                    key={n.id}
                    className={`rounded-lg p-2 ${
                      n.isRead ? "" : "bg-rose-50/60 dark:bg-rose-950/20"
                    }`}
                  >
                    <div className="flex gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-xs font-semibold text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                        {n.senderAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element -- arbitrary avatar URL
                          <img src={n.senderAvatar} alt="" className="size-full object-cover" />
                        ) : (
                          initial(n)
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-800 dark:text-zinc-100">
                          {messageFor(n)}
                        </p>
                        {n.message && (
                          <p className="mt-0.5 truncate text-xs italic text-zinc-500 dark:text-zinc-400">
                            “{n.message}”
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          {relativeTime(n.createdAt)}
                        </p>

                        {/* Interactive: friend request */}
                        {n.type === "friend_request" && n.referenceId && (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(n.id, () =>
                                  respondFriendRequest(n.referenceId!, true),
                                )
                              }
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-rose-500 px-2 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-60"
                            >
                              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                              Accept
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(n.id, () =>
                                  respondFriendRequest(n.referenceId!, false),
                                )
                              }
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              <X className="size-3.5" />
                              Decline
                            </button>
                          </div>
                        )}

                        {/* Interactive: space invite */}
                        {n.type === "space_invite" && (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(n.id, () => respondSpaceInvite(n.id, true))
                              }
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-rose-500 px-2 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-60"
                            >
                              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />}
                              Join
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(n.id, () => respondSpaceInvite(n.id, false))
                              }
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              <X className="size-3.5" />
                              Decline
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Result notifications: dismiss */}
                      {isResult && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(n.id, () => dismissNotification(n.id))
                          }
                          aria-label="Dismiss"
                          className="size-6 shrink-0 rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-60 dark:hover:bg-zinc-800"
                        >
                          {busy ? (
                            <Loader2 className="mx-auto size-3.5 animate-spin" />
                          ) : (
                            <Check className="mx-auto size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
