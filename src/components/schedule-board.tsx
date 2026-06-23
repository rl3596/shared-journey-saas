"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X, CalendarDays, Pencil, Trash2 } from "lucide-react";
import type { EventOwner, ScheduleEvent } from "@/data/schedule";

const OWNERS: EventOwner[] = ["Rui", "Wanyun", "Joint"];
const FILTERS = ["All", "Rui", "Wanyun", "Joint"] as const;
type Filter = (typeof FILTERS)[number];

const ownerStyles: Record<
  EventOwner,
  { dot: string; badge: string; border: string }
> = {
  Rui: {
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    border: "border-l-blue-500",
  },
  Wanyun: {
    dot: "bg-pink-500",
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
    border: "border-l-pink-500",
  },
  Joint: {
    dot: "bg-purple-500",
    badge:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
    border: "border-l-purple-500",
  },
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-rose-500 dark:focus:ring-rose-900/50";
const labelText =
  "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  if (!t) return "";
  const [h, min] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  return new Date(2000, 0, 1, h, min || 0).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

const emptyForm = {
  title: "",
  owner: "Joint" as EventOwner,
  date: "",
  time: "12:00",
  notes: "",
};

export default function ScheduleBoard({
  initialEvents,
}: {
  initialEvents: ScheduleEvent[];
}) {
  const [events, setEvents] = useState<ScheduleEvent[]>(initialEvents);
  const [filter, setFilter] = useState<Filter>("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // When `editing` is non-null the dialog is in edit mode, pre-filled with
  // that event's values; the same form drives both create and edit.
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  // When `deleteTarget` is non-null the delete-confirmation modal is open.
  const [deleteTarget, setDeleteTarget] = useState<ScheduleEvent | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const filtered = events.filter(
      (e) => filter === "All" || e.owner === filter,
    );
    const sorted = [...filtered].sort((a, b) =>
      a.date === b.date
        ? a.time.localeCompare(b.time)
        : a.date.localeCompare(b.date),
    );
    const out: { date: string; items: ScheduleEvent[] }[] = [];
    for (const e of sorted) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else out.push({ date: e.date, items: [e] });
    }
    return out;
  }, [events, filter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, date: todayISO() });
    setDialogOpen(true);
  };
  const openEdit = (event: ScheduleEvent) => {
    setEditing(event);
    setForm({
      title: event.title,
      owner: event.owner,
      date: event.date,
      time: event.time,
      notes: event.notes,
    });
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;

    const payload = {
      owner: form.owner,
      title: form.title.trim(),
      date: form.date,
      time: form.time,
      notes: form.notes.trim(),
    };

    if (editing) {
      // Edit mode: optimistic update with rollback on failure.
      const before = editing;
      const updated: ScheduleEvent = { ...editing, ...payload };
      setEvents((prev) =>
        prev.map((ev) => (ev.id === editing.id ? updated : ev)),
      );
      setDialogOpen(false);
      try {
        const res = await fetch(`/api/events/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setEvents((prev) =>
            prev.map((ev) => (ev.id === before.id ? before : ev)),
          );
        }
      } catch {
        setEvents((prev) =>
          prev.map((ev) => (ev.id === before.id ? before : ev)),
        );
      }
      return;
    }

    // Create mode: optimistic insert, swap in the server's id when it lands.
    const optimistic: ScheduleEvent = { id: crypto.randomUUID(), ...payload };
    setEvents((prev) => [...prev, optimistic]);
    setFilter("All"); // make sure the new event is visible
    setDialogOpen(false);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.event) {
          setEvents((prev) =>
            prev.map((ev) => (ev.id === optimistic.id ? data.event : ev)),
          );
        }
      }
    } catch {
      // Offline / not configured — keep the optimistic event.
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const snapshot = deleteTarget;
    setBusy(true);
    // Optimistic remove.
    setEvents((prev) => prev.filter((ev) => ev.id !== snapshot.id));
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/events/${snapshot.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // Roll back: put the event back into the list.
        setEvents((prev) => [...prev, snapshot]);
      }
    } catch {
      setEvents((prev) => [...prev, snapshot]);
    }
    setBusy(false);
  };

  // Escape closes whichever modal is open; lock background scroll too.
  useEffect(() => {
    const isAnyOpen = dialogOpen || deleteTarget !== null;
    if (!isAnyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (deleteTarget !== null) {
        if (!busy) setDeleteTarget(null);
      } else if (dialogOpen) {
        setDialogOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [dialogOpen, deleteTarget, busy]);

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {f !== "All" && (
                <span className={`size-2 rounded-full ${ownerStyles[f].dot}`} />
              )}
              {f}
            </button>
          );
        })}
      </div>

      {/* Event list grouped by date */}
      <div className="mt-6 space-y-6">
        {groups.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No events here yet. Tap the + button to add one.
          </div>
        )}
        {groups.map((group) => (
          <div key={group.date}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              <CalendarDays className="size-4" />
              {formatDate(group.date)}
            </div>
            <div className="space-y-2">
              {group.items.map((e) => (
                <div
                  key={e.id}
                  className={`relative rounded-r-lg border-l-4 bg-white p-4 shadow-sm ring-1 ring-zinc-100 ${ownerStyles[e.owner].border} dark:bg-zinc-900 dark:ring-zinc-800`}
                >
                  {/* Edit / delete actions, top-right of each card. */}
                  <div className="absolute right-2 top-2 flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => openEdit(e)}
                      aria-label="Edit event"
                      title="Edit event"
                      className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-600 dark:hover:bg-zinc-800 dark:hover:text-rose-400"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(e)}
                      aria-label="Delete event"
                      title="Delete event"
                      className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pr-16">
                    <span className="text-sm font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatTime(e.time)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ownerStyles[e.owner].badge}`}
                    >
                      {e.owner}
                    </span>
                  </div>
                  <h3 className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
                    {e.title}
                  </h3>
                  {e.notes && (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {e.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating add button */}
      <button
        type="button"
        onClick={openCreate}
        aria-label="Add new event"
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition hover:scale-105 hover:bg-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-200 dark:focus:ring-rose-900/50"
      >
        <Plus className="size-6" />
      </button>

      {/* Add-event dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeDialog}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit event" : "Add new event"}
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {editing ? "Edit Event" : "Add New Event"}
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                aria-label="Close"
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <label className="block">
                <span className={labelText}>Title</span>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, title: ev.target.value }))
                  }
                  placeholder="e.g. Dinner reservation"
                  className={inputClass}
                />
              </label>

              <div>
                <span className={labelText}>Owner</span>
                <div className="flex gap-2">
                  {OWNERS.map((o) => {
                    const selected = form.owner === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, owner: o }))}
                        aria-pressed={selected}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          selected
                            ? "border-transparent bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <span
                          className={`size-2 rounded-full ${ownerStyles[o].dot}`}
                        />
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelText}>Date</span>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(ev) =>
                      setForm((f) => ({ ...f, date: ev.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelText}>Time</span>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(ev) =>
                      setForm((f) => ({ ...f, time: ev.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelText}>Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, notes: ev.target.value }))
                  }
                  placeholder="Optional details…"
                  className={`${inputClass} resize-none`}
                />
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600"
                >
                  {editing ? "Save Changes" : "Add Event"}
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
            aria-label="Delete event"
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Delete event?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              &ldquo;{deleteTarget.title}&rdquo; will be permanently removed.
            </p>
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
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
