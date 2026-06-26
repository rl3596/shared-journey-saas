"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, CalendarDays, Users, Pencil, Trash2, Loader2, Globe } from "lucide-react";
import type { ScheduleEvent } from "@/data/schedule";
import type { SpaceMember } from "@/lib/data";
import { createEvent, updateEvent, deleteEvent } from "@/lib/actions/schedule";
import {
  eventInstantMs,
  formatTimeInZone,
  formatDateInZone,
  zoneAbbrev,
  dayKeyInZone,
  detectTimeZone,
  allTimeZones,
  prettyZone,
} from "@/lib/timezone";

const FILTERS = ["All", "Mine", "Joint"] as const;
type Filter = (typeof FILTERS)[number];
type Scope = "upcoming" | "past";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelText = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
function plainTime(t: string): string {
  if (!t) return "";
  const [h, min] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  return new Date(2000, 0, 1, h, min || 0).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Viewer's IANA zone — null during SSR/first paint, real value after mount. */
function useViewerTimeZone(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

function styleFor(e: ScheduleEvent, currentUserId: string) {
  if (e.isJoint)
    return {
      badge: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
      border: "border-l-purple-500",
    };
  if (e.creatorId === currentUserId)
    return {
      badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
      border: "border-l-rose-500",
    };
  return {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    border: "border-l-blue-500",
  };
}

/** Time of an event shown in its own zone, plus the viewer's local equivalent. */
function EventTime({ e, viewerTz }: { e: ScheduleEvent; viewerTz: string | null }) {
  if (!e.time) return null;
  const tz = e.timezone || viewerTz || "";
  if (!tz) {
    return (
      <span className="text-sm font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
        {plainTime(e.time)}
      </span>
    );
  }
  const instant = eventInstantMs(e.date, e.time, tz);
  const own = formatTimeInZone(instant, tz);
  const abbr = zoneAbbrev(instant, tz);
  const showYours = !!viewerTz && !!e.timezone && e.timezone !== viewerTz;
  let yours: string | null = null;
  if (showYours && viewerTz) {
    const t = formatTimeInZone(instant, viewerTz);
    const shifted = dayKeyInZone(instant, viewerTz) !== e.date;
    yours = shifted
      ? `${t}, ${formatDateInZone(instant, viewerTz)} your time`
      : `${t} your time`;
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-sm font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
        {own}
      </span>
      <span className="text-xs text-zinc-400">{abbr}</span>
      {yours && (
        <span className="text-xs font-medium text-rose-500 dark:text-rose-400">
          · {yours}
        </span>
      )}
    </span>
  );
}

type DraftMode = "personal" | "joint";

export default function ScheduleBoard({
  initialEvents,
  currentUserId,
  members,
}: {
  initialEvents: ScheduleEvent[];
  currentUserId: string;
  members: SpaceMember[];
}) {
  const router = useRouter();
  const events = initialEvents;
  const viewerTz = useViewerTimeZone();
  const zones = useMemo(() => allTimeZones(), []);
  const [filter, setFilter] = useState<Filter>("All");
  const [scope, setScope] = useState<Scope>("upcoming");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  const [mode, setMode] = useState<DraftMode>("personal");
  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "12:00",
    timezone: "UTC",
    notes: "",
  });
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleEvent | null>(null);

  // Capture "now" once per render for past/upcoming classification.
  const [now] = useState(() => Date.now());

  const groups = useMemo(() => {
    const instantOf = (e: ScheduleEvent) =>
      eventInstantMs(e.date, e.time, e.timezone || viewerTz || "UTC");
    const owned = events.filter((e) =>
      filter === "All"
        ? true
        : filter === "Mine"
          ? e.creatorId === currentUserId
          : e.isJoint,
    );
    const scoped = owned.filter((e) => {
      const isPast = instantOf(e) < now;
      return scope === "past" ? isPast : !isPast;
    });
    const sorted = [...scoped].sort((a, b) => {
      const diff = instantOf(a) - instantOf(b);
      return scope === "past" ? -diff : diff;
    });
    const out: { date: string; items: ScheduleEvent[] }[] = [];
    for (const e of sorted) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else out.push({ date: e.date, items: [e] });
    }
    return out;
  }, [events, filter, scope, currentUserId, viewerTz, now]);

  const openCreate = (m: DraftMode) => {
    setEditing(null);
    setMode(m);
    setForm({
      title: "",
      date: todayISO(),
      time: "12:00",
      timezone: detectTimeZone(),
      notes: "",
    });
    setParticipants(new Set());
    setError(null);
    setDialogOpen(true);
  };
  const openEdit = (e: ScheduleEvent) => {
    setEditing(e);
    setMode(e.isJoint ? "joint" : "personal");
    setForm({
      title: e.title,
      date: e.date,
      time: e.time || "12:00",
      timezone: e.timezone || detectTimeZone(),
      notes: e.notes,
    });
    setParticipants(new Set(e.participantIds));
    setError(null);
    setDialogOpen(true);
  };
  const close = () => setDialogOpen(false);

  const toggleParticipant = (id: string) =>
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setBusy(true);
    setError(null);
    const participantIds = mode === "joint" ? [...participants] : [];
    const payload = {
      title: form.title,
      date: form.date,
      time: form.time,
      timezone: form.timezone,
      notes: form.notes,
      participantIds,
    };
    const res = editing
      ? await updateEvent(editing.id, payload)
      : await createEvent(payload);
    if (res.ok) {
      setDialogOpen(false);
      if (!editing) {
        setFilter("All");
        setScope("upcoming");
      }
      router.refresh();
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    const res = await deleteEvent(deleteTarget.id);
    if (res.ok) {
      setDeleteTarget(null);
      router.refresh();
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  // Escape + scroll lock for either modal.
  useEffect(() => {
    const open = dialogOpen || deleteTarget !== null;
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || busy) return;
      setDialogOpen(false);
      setDeleteTarget(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [dialogOpen, deleteTarget, busy]);

  const hasMembers = members.length > 0;

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Upcoming / Past */}
          <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
            {(["upcoming", "past"] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setScope(sc)}
                aria-pressed={scope === sc}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  scope === sc
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {sc}
              </button>
            ))}
          </div>
          {/* All / Mine / Joint */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={active}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
        {hasMembers && (
          <button
            type="button"
            onClick={() => openCreate("joint")}
            className="inline-flex items-center gap-2 rounded-lg border border-purple-300 px-3 py-1.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-50 dark:border-purple-900/50 dark:text-purple-300 dark:hover:bg-purple-950/30"
          >
            <Users className="size-4" />
            Create joint event
          </button>
        )}
      </div>

      {/* Event list grouped by date */}
      <div className="mt-6 space-y-6">
        {groups.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {scope === "past"
              ? "No past events to look back on yet."
              : "No upcoming events. Tap the + button to add one."}
          </div>
        )}
        {groups.map((group) => (
          <div key={group.date}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              <CalendarDays className="size-4" />
              {formatDate(group.date)}
            </div>
            <div className="space-y-2">
              {group.items.map((e) => {
                const s = styleFor(e, currentUserId);
                const mine = e.creatorId === currentUserId;
                const people = [
                  mine ? "You" : e.creatorName,
                  ...e.participantNames,
                ].join(", ");
                return (
                  <div
                    key={e.id}
                    className={`relative rounded-r-lg border-l-4 bg-white p-4 shadow-sm ring-1 ring-zinc-100 ${s.border} dark:bg-zinc-900 dark:ring-zinc-800`}
                  >
                    {mine && (
                      <div className="absolute right-2 top-2 flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          aria-label="Edit event"
                          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-600 dark:hover:bg-zinc-800 dark:hover:text-rose-400"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(e)}
                          aria-label="Delete event"
                          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pr-16">
                      <EventTime e={e} viewerTz={viewerTz} />
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>
                        {e.isJoint ? "Joint" : mine ? "You" : e.creatorName}
                      </span>
                    </div>
                    <h3 className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
                      {e.title}
                    </h3>
                    {e.isJoint && (
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {people}
                      </p>
                    )}
                    {e.notes && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {e.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Floating add (personal) */}
      <button
        type="button"
        onClick={() => openCreate("personal")}
        aria-label="Add event"
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition hover:scale-105 hover:bg-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-200 dark:focus:ring-rose-900/50"
      >
        <Plus className="size-6" />
      </button>

      {/* Add / edit dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !busy && close()}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {editing
                  ? "Edit event"
                  : mode === "joint"
                    ? "New joint event"
                    : "New event"}
              </h2>
              <button
                type="button"
                onClick={() => !busy && close()}
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
                  onChange={(ev) => setForm((f) => ({ ...f, title: ev.target.value }))}
                  placeholder="e.g. Dinner reservation"
                  className={inputClass}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelText}>Date</span>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(ev) => setForm((f) => ({ ...f, date: ev.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelText}>Time</span>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(ev) => setForm((f) => ({ ...f, time: ev.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelText}>
                  <Globe className="mr-1 inline size-3.5 align-[-2px]" />
                  Time zone
                </span>
                <select
                  value={form.timezone}
                  onChange={(ev) => setForm((f) => ({ ...f, timezone: ev.target.value }))}
                  className={inputClass}
                >
                  {!zones.includes(form.timezone) && form.timezone && (
                    <option value={form.timezone}>{prettyZone(form.timezone)}</option>
                  )}
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {prettyZone(z)}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-zinc-400">
                  Others see this time converted to their own zone.
                </span>
              </label>

              {/* Joint participant picker */}
              {hasMembers && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className={labelText}>
                      {mode === "joint" ? "Include members" : "Make it joint?"}
                    </span>
                    {mode === "personal" ? (
                      <button
                        type="button"
                        onClick={() => setMode("joint")}
                        className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400"
                      >
                        + Include others
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("personal");
                          setParticipants(new Set());
                        }}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                      >
                        Make personal
                      </button>
                    )}
                  </div>
                  {mode === "joint" && (
                    <div className="mt-1 space-y-1 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                      {members.map((m) => (
                        <label
                          key={m.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <input
                            type="checkbox"
                            checked={participants.has(m.id)}
                            onChange={() => toggleParticipant(m.id)}
                            className="size-4 accent-rose-500"
                          />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label className="block">
                <span className={labelText}>Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(ev) => setForm((f) => ({ ...f, notes: ev.target.value }))}
                  placeholder="Optional details…"
                  className={`${inputClass} resize-none`}
                />
              </label>

              {error && (
                <p className="break-words text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => !busy && close()}
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
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Delete event?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              &ldquo;{deleteTarget.title}&rdquo; will be permanently removed.
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
