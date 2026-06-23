"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { User, Settings, LogOut, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  username: string | null;
  avatarUrl: string | null;
  /** Called after navigating (lets the mobile menu close itself). */
  onNavigate?: () => void;
};

function initials(name: string | null): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "·";
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 outline-none transition-colors data-[highlighted]:bg-zinc-100 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800";

export default function UserMenu({ username, avatarUrl, onNavigate }: Props) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const go = (path: string) => {
    onNavigate?.();
    router.push(path);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } catch {
      /* sign out locally regardless */
    }
    onNavigate?.();
    router.replace("/login");
    router.refresh();
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-sm font-semibold text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- user avatar from Supabase Storage / arbitrary URL
              <img
                src={avatarUrl}
                alt=""
                className="size-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              initials(username)
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {username ?? "Account"}
          </span>
          <ChevronUp className="size-4 shrink-0 text-zinc-400" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 w-[--radix-dropdown-menu-trigger-width] min-w-52 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <DropdownMenu.Item className={itemClass} onSelect={() => go("/settings")}>
            <User className="size-4 shrink-0 text-zinc-400" />
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item className={itemClass} onSelect={() => go("/settings")}>
            <Settings className="size-4 shrink-0 text-zinc-400" />
            Settings
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          <DropdownMenu.Item
            className={itemClass}
            disabled={signingOut}
            onSelect={(e) => {
              e.preventDefault();
              handleSignOut();
            }}
          >
            <LogOut className="size-4 shrink-0 text-zinc-400" />
            {signingOut ? "Signing out…" : "Logout"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
