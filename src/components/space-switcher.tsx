"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronsUpDown, Check, Plus, Loader2 } from "lucide-react";
import { setActiveSpace, createSpace } from "@/lib/actions/space";
import { useJourneyAdmin } from "@/components/journey-admin-context";

type SpaceItem = { id: string; name: string; role: string };

function squareInitial(name: string): string {
  return (name.trim()[0] ?? "·").toUpperCase();
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 outline-none transition-colors data-[highlighted]:bg-zinc-100 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800";

export default function SpaceSwitcher({
  spaces,
  activeSpaceId,
}: {
  spaces: SpaceItem[];
  activeSpaceId: string;
}) {
  const router = useRouter();
  const active = spaces.find((s) => s.id === activeSpaceId) ?? spaces[0];

  const [switching, setSwitching] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Secret: 5 clicks on the space square within 3s toggles Journey Admin Mode.
  const { isJourneyAdmin, toggleJourneyAdmin, showToast } = useJourneyAdmin();
  const clicksRef = useRef<number[]>([]);
  const handleSecret = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    clicksRef.current = clicksRef.current.filter((t) => now - t < 3000);
    clicksRef.current.push(now);
    if (clicksRef.current.length >= 5) {
      clicksRef.current = [];
      const willBeAdmin = !isJourneyAdmin;
      toggleJourneyAdmin();
      showToast(`Edit mode: ${willBeAdmin ? "Activated" : "Deactivated"}`);
    }
  };

  const switchTo = async (id: string) => {
    if (id === activeSpaceId) return;
    setSwitching(true);
    await setActiveSpace(id);
    router.refresh();
    setSwitching(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await createSpace(newName);
    if (res.ok) {
      setCreateOpen(false);
      setNewName("");
      router.refresh();
    } else {
      setCreateError(res.error);
    }
    setCreating(false);
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Switch space"
            className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span
              role="button"
              tabIndex={-1}
              onClick={handleSecret}
              className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-rose-400 to-amber-400 text-sm font-bold text-white"
            >
              {squareInitial(active?.name ?? "·")}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {active?.name ?? "Space"}
            </span>
            {switching ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-zinc-400" />
            ) : (
              <ChevronsUpDown className="size-4 shrink-0 text-zinc-400" />
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 w-64 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <DropdownMenu.Label className="px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Your spaces
            </DropdownMenu.Label>
            {spaces.map((s) => (
              <DropdownMenu.Item
                key={s.id}
                className={itemClass}
                onSelect={() => switchTo(s.id)}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-gradient-to-br from-rose-400 to-amber-400 text-xs font-bold text-white">
                  {squareInitial(s.name)}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {s.id === activeSpaceId && (
                  <Check className="size-4 shrink-0 text-rose-500" />
                )}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            <DropdownMenu.Item
              className={itemClass}
              onSelect={(e) => {
                e.preventDefault();
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4 shrink-0 text-zinc-400" />
              Create or join a space
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Create-space dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !creating && setCreateOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create a space"
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Create a space
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              A new space starts empty, with you as the owner. To join someone
              else&apos;s space, ask them to invite your @handle — you&apos;ll
              get a notification to accept.
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Space name"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              {createError && (
                <p className="break-words text-sm text-red-600 dark:text-red-400">
                  {createError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !creating && setCreateOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
                >
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  Create space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
