"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, Check, X, Loader2 } from "lucide-react";
import {
  acceptInvitation,
  declineInvitation,
} from "@/lib/actions/invite";

export type Invite = {
  id: string;
  spaceName: string;
  inviterHandle: string | null;
  inviterName: string | null;
};

export default function NotificationBell({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const count = invites.length;

  const act = async (id: string, kind: "accept" | "decline") => {
    setBusyId(id);
    if (kind === "accept") await acceptInvitation(id);
    else await declineInvitation(id);
    router.refresh();
    setBusyId(null);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Notifications${count ? ` (${count})` : ""}`}
          className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-72 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Invitations
          </p>
          {count === 0 ? (
            <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              No pending invitations.
            </p>
          ) : (
            <ul className="space-y-1">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <p className="text-sm text-zinc-800 dark:text-zinc-100">
                    <span className="font-medium">
                      {inv.inviterName ??
                        (inv.inviterHandle ? `@${inv.inviterHandle}` : "Someone")}
                    </span>{" "}
                    invited you to{" "}
                    <span className="font-medium">{inv.spaceName}</span>
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => act(inv.id, "accept")}
                      disabled={busyId === inv.id}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-rose-500 px-2 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-60"
                    >
                      {busyId === inv.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => act(inv.id, "decline")}
                      disabled={busyId === inv.id}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <X className="size-3.5" />
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
