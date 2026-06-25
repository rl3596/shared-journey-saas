"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Plus, Loader2 } from "lucide-react";
import type { TimelineComment } from "@/data/love-journey";
import { addComment, editComment, removeComment } from "@/lib/actions/journey";

const textareaClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 resize-none";

function AuthorLabel({ name }: { name: string }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400">
      {name}
    </span>
  );
}

export default function MilestoneComments({
  eventId,
  comments,
  currentUserId,
  ownerId,
  currentUserName,
  editMode,
}: {
  eventId: string;
  comments: TimelineComment[];
  currentUserId: string;
  ownerId: string | null;
  currentUserName: string;
  editMode: boolean;
}) {
  const router = useRouter();
  const myComment = comments.find((c) => c.authorId === currentUserId) ?? null;

  const [editingId, setEditingId] = useState<string | null>(null); // comment id or "new"
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (c: TimelineComment) => {
    setEditingId(c.id);
    setDraft(c.content);
    setError(null);
  };
  const startAdd = () => {
    setEditingId("new");
    setDraft("");
    setError(null);
  };
  const cancel = () => {
    setEditingId(null);
    setDraft("");
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const res =
      editingId === "new"
        ? await addComment(eventId, draft)
        : await editComment(editingId!, draft);
    if (res.ok) {
      setEditingId(null);
      setDraft("");
      router.refresh();
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  const del = async (id: string) => {
    setBusy(true);
    setError(null);
    const res = await removeComment(id);
    if (res.ok) router.refresh();
    else setError(res.error);
    setBusy(false);
  };

  // ---- View mode: show only non-empty comments ----
  if (!editMode) {
    const visible = comments.filter((c) => c.content.trim());
    if (visible.length === 0) return null;
    return (
      <div className="mt-4 space-y-3">
        {visible.map((c) => (
          <div key={c.id}>
            <AuthorLabel name={c.authorName} />
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {c.content}
            </p>
          </div>
        ))}
      </div>
    );
  }

  // ---- Edit mode ----
  const Editor = (
    <div className="space-y-2">
      <textarea
        rows={3}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="What this moment meant to you…"
        className={textareaClass}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Save
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <X className="size-3.5" />
          Cancel
        </button>
      </div>
      {error && (
        <p className="break-words text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );

  return (
    <div className="mt-4 space-y-4">
      {comments.map((c) => {
        const mine = c.authorId === currentUserId;
        const isOwnerComment = c.authorId === ownerId;

        // Others' comments: read-only, skip empties.
        if (!mine) {
          if (!c.content.trim()) return null;
          return (
            <div key={c.id}>
              <AuthorLabel name={c.authorName} />
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {c.content}
              </p>
            </div>
          );
        }

        // My comment.
        return (
          <div key={c.id}>
            <div className="flex items-center justify-between gap-2">
              <AuthorLabel name={c.authorName} />
              {editingId !== c.id && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    aria-label="Edit your note"
                    className="rounded-md p-1 text-zinc-400 transition-colors hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  {/* The space owner's comment can't be deleted. */}
                  {!isOwnerComment && (
                    <button
                      type="button"
                      onClick={() => del(c.id)}
                      disabled={busy}
                      aria-label="Delete your note"
                      className="rounded-md p-1 text-zinc-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {editingId === c.id ? (
              <div className="mt-1">{Editor}</div>
            ) : c.content.trim() ? (
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {c.content}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => startEdit(c)}
                className="mt-1 text-sm italic text-zinc-400 hover:text-rose-500 dark:text-zinc-500"
              >
                Add your note…
              </button>
            )}
          </div>
        );
      })}

      {/* Add-comment box for members who don't have a comment yet. */}
      {!myComment &&
        (editingId === "new" ? (
          <div>
            <AuthorLabel name={currentUserName} />
            <div className="mt-1">{Editor}</div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-rose-300 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-rose-400"
          >
            <Plus className="size-3.5" />
            Add comment
          </button>
        ))}
    </div>
  );
}
