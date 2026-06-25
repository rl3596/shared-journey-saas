"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import type { TimelineEvent } from "@/data/love-journey";
import { useJourneyAdmin } from "@/components/journey-admin-context";
import { isHeic, prepareImageForUpload } from "@/lib/heic-convert";
import MilestoneComments from "@/components/milestone-comments";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-rose-500 dark:focus:ring-rose-900/50";
const labelText =
  "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

// Single warm accent for the whole timeline (the old per-perspective blue/rose
// switching no longer applies now that comments are per-member).
const ACCENT = {
  rail: "from-rose-200 via-rose-300 to-amber-200 dark:from-rose-900/60 dark:via-rose-800/60 dark:to-amber-900/40",
  dot: "bg-rose-500 ring-rose-100 dark:ring-rose-950/50",
  dateText: "text-rose-500 dark:text-rose-400",
  mapPin: "text-rose-400",
  hoverBorder: "hover:border-rose-200 dark:hover:border-rose-900/70",
  fab: "bg-rose-500 hover:bg-rose-600 focus:ring-rose-200 dark:focus:ring-rose-900/50",
};

const emptyForm = { date: "", title: "", location: "" };

function toIsoDate(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromIsoDate(iso: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function splitDateForTimeline(s: string): { primary: string; year: string } {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return {
      primary: date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      }),
      year: iso[1],
    };
  }
  const display = /^(.+?),\s*(\d{4})\s*$/.exec(s);
  if (display) return { primary: display[1].trim(), year: display[2] };
  return { primary: s, year: "" };
}

export default function LoveJourneyTimeline({
  events,
  currentUserId,
  ownerId,
  currentUserName,
  isOwner,
}: {
  events: TimelineEvent[];
  currentUserId: string;
  ownerId: string | null;
  currentUserName: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { isJourneyAdmin } = useJourneyAdmin();
  // Only the space owner manages the milestone shell (create/edit/delete).
  const canManage = isOwner && isJourneyAdmin;

  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimelineEvent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [note, setNote] = useState("");
  const coverRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimelineEvent | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const revealed = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target.getAttribute("data-id"))
          .filter((id): id is string => id !== null);
        if (revealed.length > 0) {
          setVisibleIds((prev) => new Set([...prev, ...revealed]));
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    events.forEach((ev) => {
      const el = itemRefs.current.get(ev.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [events]);

  const modalOpen = formOpen || !!deleteTarget;
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setFormOpen(false);
        setDeleteTarget(null);
      }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [modalOpen, busy]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setNote("");
    setError(null);
    if (coverRef.current) coverRef.current.value = "";
    setFormOpen(true);
  };
  const openEdit = (ev: TimelineEvent) => {
    setEditing(ev);
    setForm({ date: ev.date, title: ev.title, location: ev.location });
    setError(null);
    if (coverRef.current) coverRef.current.value = "";
    setFormOpen(true);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date.trim() || !form.title.trim()) return;

    const fd = new FormData();
    fd.append("date", form.date.trim());
    fd.append("title", form.title.trim());
    fd.append("location", form.location.trim());
    if (!editing) fd.append("comment", note.trim());
    const cover = coverRef.current?.files?.[0];

    setBusy(true);
    setError(null);
    try {
      if (cover) {
        if (isHeic(cover)) setConverting(true);
        try {
          const ready = await prepareImageForUpload(cover);
          fd.append("cover", ready);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Convert failed: ${msg}`);
        }
        setConverting(false);
      }

      const res = await fetch(
        editing ? `/api/timeline/${editing.id}` : "/api/timeline",
        { method: editing ? "PATCH" : "POST", body: fd },
      );
      const bodyText = await res.text().catch(() => "");
      let data: { error?: string } | null = null;
      try {
        data = JSON.parse(bodyText);
      } catch {
        /* leave null */
      }

      if (res.ok) {
        setFormOpen(false);
        if (coverRef.current) coverRef.current.value = "";
        router.refresh();
      } else {
        setError(`Server ${res.status}: ${data?.error || bodyText.slice(0, 200)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setConverting(false);
    setBusy(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/timeline/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not delete the milestone.");
      }
    } catch {
      setError("Delete failed. Please try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <div className="relative">
        <div
          aria-hidden
          className={`absolute inset-y-0 left-5 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b md:left-1/2 ${ACCENT.rail}`}
        />

        {events.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {canManage
              ? "No milestones yet — tap the + button to add your first one."
              : "No milestones yet."}
          </div>
        )}

        <ol className="space-y-10">
          {events.map((event, index) => {
            const isVisible = visibleIds.has(event.id);
            const onLeft = index % 2 === 0;
            const dateParts = splitDateForTimeline(event.date);

            return (
              <li
                key={event.id}
                data-id={event.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(event.id, el);
                  else itemRefs.current.delete(event.id);
                }}
                className="relative"
              >
                <span
                  aria-hidden
                  className={`absolute left-5 top-6 z-10 size-4 -translate-x-1/2 rounded-full border-2 border-white ring-4 transition-all duration-500 ease-out md:left-1/2 dark:border-zinc-950 ${ACCENT.dot} ${
                    isVisible ? "scale-100" : "scale-0"
                  }`}
                />

                <div
                  className={`flex transition-all duration-700 ease-out motion-reduce:transition-none ${
                    onLeft ? "md:flex-row" : "md:flex-row-reverse"
                  } ${
                    isVisible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-8 opacity-0 motion-reduce:translate-y-0"
                  }`}
                >
                  <div className="w-full pl-12 md:w-1/2 md:px-8">
                    <article
                      className={`group relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-zinc-800 dark:bg-zinc-900 ${ACCENT.hoverBorder}`}
                    >
                      {/* Milestone edit/delete — owner only. */}
                      {canManage && (
                        <div className="absolute right-3 top-3 z-10 flex gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(event)}
                            aria-label="Edit milestone"
                            className="rounded-md bg-white/90 p-1.5 text-zinc-500 shadow-sm ring-1 ring-zinc-200 transition-colors hover:text-rose-600 dark:bg-zinc-800/90 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:text-rose-400"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(event)}
                            aria-label="Delete milestone"
                            className="rounded-md bg-white/90 p-1.5 text-zinc-500 shadow-sm ring-1 ring-zinc-200 transition-colors hover:text-red-600 dark:bg-zinc-800/90 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:text-red-400"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      )}

                      {event.image && (
                        <div className="relative mb-4 aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 dark:from-rose-950/40 dark:to-amber-950/30">
                          {/* eslint-disable-next-line @next/next/no-img-element -- user cover image from Supabase Storage */}
                          <img
                            src={event.image}
                            alt={event.title}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.visibility = "hidden";
                            }}
                            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                          />
                        </div>
                      )}
                      <time
                        className={`text-xs font-semibold uppercase tracking-wider ${ACCENT.dateText}`}
                      >
                        {event.date}
                      </time>
                      <h3
                        className={`mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50 ${
                          canManage ? "pr-16" : ""
                        }`}
                      >
                        {event.title}
                      </h3>
                      {event.location && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                          <MapPin className={`size-3.5 shrink-0 ${ACCENT.mapPin}`} />
                          <span>{event.location}</span>
                        </p>
                      )}

                      <MilestoneComments
                        eventId={event.id}
                        comments={event.comments}
                        currentUserId={currentUserId}
                        ownerId={ownerId}
                        currentUserName={currentUserName}
                        editMode={isJourneyAdmin}
                      />
                    </article>
                  </div>
                  {/* Big date opposite the card. */}
                  <div className="hidden md:flex md:w-1/2 md:items-start md:px-8 md:pt-3">
                    <div className={`flex-1 ${onLeft ? "text-left" : "text-right"}`}>
                      <div
                        className={`text-3xl font-bold tracking-tight ${ACCENT.dateText}`}
                      >
                        {dateParts.primary}
                      </div>
                      {dateParts.year && (
                        <div className="mt-1 text-sm font-medium tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                          {dateParts.year}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Add milestone — owner only. */}
      {canManage && (
        <button
          type="button"
          onClick={openCreate}
          aria-label="Add milestone"
          className={`fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full text-white shadow-lg transition duration-300 hover:scale-105 focus:outline-none focus:ring-4 ${ACCENT.fab}`}
        >
          <Plus className="size-6" />
        </button>
      )}

      {/* Add / edit milestone modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !busy && setFormOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit milestone" : "Add milestone"}
            className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {editing ? "Edit Milestone" : "Add Milestone"}
              </h2>
              <button
                type="button"
                onClick={() => !busy && setFormOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <label className="block">
                <span className={labelText}>Date</span>
                <input
                  type="date"
                  required
                  value={toIsoDate(form.date)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: fromIsoDate(e.target.value) }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelText}>Title</span>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. The Day We Met"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelText}>Location</span>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                  placeholder="e.g. Shanghai"
                  className={inputClass}
                />
              </label>

              {!editing && (
                <label className="block">
                  <span className={labelText}>{currentUserName}&apos;s note</span>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What this moment meant to you…"
                    className={`${inputClass} resize-none`}
                  />
                  <span className="mt-1 block text-xs text-zinc-400">
                    Others in your space can add their own note from each card.
                  </span>
                </label>
              )}

              <label className="block">
                <span className={labelText}>Cover image (optional)</span>
                <input
                  ref={coverRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-rose-600 hover:file:bg-rose-100 dark:text-zinc-400 dark:file:bg-rose-950/40 dark:file:text-rose-300"
                />
                {editing?.image && (
                  <span className="mt-1 block text-xs text-zinc-400">
                    Leave empty to keep the current cover.
                  </span>
                )}
              </label>

              {error && (
                <p className="break-words text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => !busy && setFormOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {converting
                    ? "Converting…"
                    : busy
                      ? "Saving…"
                      : editing
                        ? "Save Changes"
                        : "Add Milestone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !busy && setDeleteTarget(null)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete milestone"
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Delete milestone?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              &ldquo;{deleteTarget.title}&rdquo; and everyone&apos;s notes on it
              will be permanently removed
              {deleteTarget.image ? " (along with its cover photo)" : ""}.
            </p>
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !busy && setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
