"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Check,
  Plus,
  Trash2,
  Crown,
  UserPlus,
  X,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";
import { updateSpaceById, deleteSpace } from "@/app/(site)/settings/actions";
import { createSpace } from "@/lib/actions/space";
import { sendSpaceInvite } from "@/lib/actions/invite";
import type { Friend } from "@/lib/friends";
import type { SpaceMemberProfile } from "@/lib/space";

export type SpaceCard = {
  id: string;
  name: string;
  role: string;
  anniversaryDate: string;
  members: SpaceMemberProfile[];
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelText = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

function Avatar({ url, fallback }: { url: string | null; fallback: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-sm font-semibold text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary avatar URL
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        fallback.toUpperCase()
      )}
    </span>
  );
}

export default function SpaceManagement({
  spaces,
  friends,
  activeSpaceId,
  currentUserId,
}: {
  spaces: SpaceCard[];
  friends: Friend[];
  activeSpaceId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(activeSpaceId);
  const selected =
    spaces.find((s) => s.id === selectedId) ?? spaces[0] ?? null;

  // Create-space modal.
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await createSpace(newName);
    if (res.ok) {
      if (res.id) setSelectedId(res.id);
      setCreateOpen(false);
      setNewName("");
      router.refresh();
    } else {
      setCreateError(res.error);
    }
    setCreating(false);
  };

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* Master list */}
      <div className="lg:w-64 lg:shrink-0">
        <div className="space-y-1.5">
          {spaces.map((s) => {
            const active = s.id === selected?.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-400 to-amber-400 text-sm font-bold text-white">
                  {(s.name.trim()[0] ?? "·").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {s.name}
                  </span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {s.members.length}{" "}
                    {s.members.length === 1 ? "member" : "members"}
                    {s.id === activeSpaceId && " · active"}
                  </span>
                </span>
                <ChevronRight
                  className={`size-4 shrink-0 ${active ? "text-rose-400" : "text-zinc-300 dark:text-zinc-600"}`}
                />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setNewName("");
            setCreateError(null);
          }}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 p-3 text-sm font-medium text-zinc-600 transition-colors hover:border-rose-300 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-900/60"
        >
          <Plus className="size-4" /> Create New Space
        </button>
      </div>

      {/* Detail — remounts per space so its edit form re-initialises cleanly */}
      <div className="min-w-0 flex-1">
        {selected ? (
          <SpaceDetail
            key={selected.id}
            space={selected}
            friends={friends}
            currentUserId={currentUserId}
            canDelete={spaces.length > 1}
          />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No spaces.</p>
        )}
      </div>

      {/* Create-space modal */}
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
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Create a space
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              A new space starts empty, with you as the owner.
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Space name"
                className={inputClass}
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
    </div>
  );
}

function SpaceDetail({
  space,
  friends,
  currentUserId,
  canDelete,
}: {
  space: SpaceCard;
  friends: Friend[];
  currentUserId: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const isOwner = space.members.some(
    (m) => m.id === currentUserId && m.role === "owner",
  );

  // Edit form.
  const [name, setName] = useState(space.name);
  const [anniversary, setAnniversary] = useState(space.anniversaryDate);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("saving");
    setSaveError(null);
    const res = await updateSpaceById(space.id, { name, anniversaryDate: anniversary });
    if (res.ok) {
      setSaveStatus("saved");
      router.refresh();
      setTimeout(() => setSaveStatus("idle"), 2000);
    } else {
      setSaveStatus("error");
      setSaveError(res.error);
    }
  };

  // Invite modal.
  const memberIds = new Set(space.members.map((m) => m.id));
  const invitableFriends = friends.filter((f) => !memberIds.has(f.id));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const invite = async (friendId: string) => {
    setInvitingId(friendId);
    setInviteError(null);
    const res = await sendSpaceInvite(friendId, space.id);
    if (res.ok) setInvitedIds((p) => new Set(p).add(friendId));
    else setInviteError(res.error);
    setInvitingId(null);
  };

  // Delete modal.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const doDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteSpace(space.id);
    if (res.ok) {
      setDeleteOpen(false);
      router.refresh();
    } else {
      setDeleteError(res.error);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Edit */}
      <form
        onSubmit={save}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Space settings
        </h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className={labelText}>Space name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelText}>
              Anniversary date{" "}
              <span className="font-normal text-zinc-400">(optional)</span>
            </span>
            <input
              type="date"
              value={anniversary}
              onChange={(e) => setAnniversary(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
          >
            {saveStatus === "saving" && <Loader2 className="size-4 animate-spin" />}
            {saveStatus === "saved" && <Check className="size-4" />}
            {saveStatus === "saving" ? "Saving…" : "Save space"}
          </button>
          {saveStatus === "error" && saveError && (
            <span className="break-words text-sm text-red-600 dark:text-red-400">
              {saveError}
            </span>
          )}
        </div>
      </form>

      {/* Members */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Members
          </h2>
          <button
            type="button"
            onClick={() => {
              setInviteOpen(true);
              setInviteError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600"
          >
            <UserPlus className="size-4" /> Invite
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {space.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <Avatar url={m.avatarUrl} fallback={m.name[0] ?? "·"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {m.name}
                  {m.id === currentUserId && (
                    <span className="ml-1.5 text-xs font-normal text-zinc-400">(you)</span>
                  )}
                </p>
                {m.handle && (
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{m.handle}</p>
                )}
              </div>
              {m.role === "owner" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <Crown className="size-3" /> Owner
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Danger: delete space (owner only) */}
      {isOwner && (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 dark:border-red-950/50 dark:bg-red-950/10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-red-700 dark:text-red-400">
            <TriangleAlert className="size-5" /> Delete this space
          </h2>
          <p className="mt-1 text-sm text-red-600/90 dark:text-red-400/80">
            Permanently deletes <span className="font-medium">{space.name}</span>{" "}
            and all its journey, gallery, and schedule content for everyone. This
            cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
              setConfirmText("");
              setDeleteError(null);
            }}
            disabled={!canDelete}
            title={canDelete ? undefined : "You can't delete your only space."}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="size-4" /> Delete space
          </button>
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setInviteOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Invite a friend
              </h2>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Only your friends can be invited to {space.name}.
            </p>
            {inviteError && (
              <p className="mt-3 break-words text-sm text-red-600 dark:text-red-400">
                {inviteError}
              </p>
            )}
            {invitableFriends.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                {friends.length === 0
                  ? "Add friends first, then invite them here."
                  : "All your friends are already in this space."}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {invitableFriends.map((f) => {
                  const done = invitedIds.has(f.id);
                  return (
                    <li key={f.id} className="flex items-center gap-3">
                      <Avatar url={f.avatarUrl} fallback={f.name[0] ?? "·"} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{f.name}</p>
                        {f.handle && (
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{f.handle}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => invite(f.id)}
                        disabled={done || invitingId === f.id}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                          done
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-60"
                        }`}
                      >
                        {invitingId === f.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : done ? (
                          <Check className="size-4" />
                        ) : (
                          <UserPlus className="size-4" />
                        )}
                        {done ? "Invited" : "Invite"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation (type-to-confirm) */}
      {deleteOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-red-700 dark:text-red-400">
              <TriangleAlert className="size-5" /> Delete {space.name}?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This permanently removes the space and{" "}
              <span className="font-medium">all of its content</span> for every
              member. To confirm, type the space name below.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={space.name}
              className={`mt-3 ${inputClass}`}
            />
            {deleteError && (
              <p className="mt-2 break-words text-sm text-red-600 dark:text-red-400">
                {deleteError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !deleting && setDeleteOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doDelete}
                disabled={deleting || confirmText.trim() !== space.name}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                Permanently delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
