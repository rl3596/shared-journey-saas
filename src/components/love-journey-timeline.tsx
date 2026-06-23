"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import type { TimelineEvent } from "@/data/love-journey";
import { useJourneyAdmin } from "@/components/journey-admin-context";
import { isHeic, prepareImageForUpload } from "@/lib/heic-convert";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-rose-500 dark:focus:ring-rose-900/50";
const labelText =
  "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const emptyForm = {
  date: "",
  title: "",
  contentRui: "",
  contentWanyun: "",
  location: "",
};

type Perspective = "rui" | "wanyun";

const PERSPECTIVE_LABELS: Record<Perspective, { tab: string; empty: string }> = {
  rui: {
    tab: "Rui's Memory",
    empty: "Rui hasn't shared his memory of this moment yet…",
  },
  wanyun: {
    tab: "Wanyun's Memory",
    empty: "Wanyun hasn't shared her memory of this moment yet…",
  },
};

// Accent palette per perspective. Rose/amber (warm) for Wanyun, blue/sky
// (cool) for Rui — both lean soft to keep the warm-analog feel. Each value
// is a literal string so Tailwind's class scanner keeps them in the build.
const ACCENT: Record<
  Perspective,
  {
    rail: string;
    dot: string;
    dateText: string;
    mapPin: string;
    hoverBorder: string;
    fab: string;
    tabActive: string;
    tabUnderline: string;
  }
> = {
  rui: {
    rail: "from-blue-200 via-blue-300 to-sky-200 dark:from-blue-900/60 dark:via-blue-800/60 dark:to-sky-900/40",
    dot: "bg-blue-500 ring-blue-100 dark:ring-blue-950/50",
    dateText: "text-blue-500 dark:text-blue-400",
    mapPin: "text-blue-400",
    hoverBorder: "hover:border-blue-200 dark:hover:border-blue-900/70",
    fab: "bg-blue-500 hover:bg-blue-600 focus:ring-blue-200 dark:focus:ring-blue-900/50",
    tabActive: "text-blue-600 dark:text-blue-400",
    tabUnderline: "bg-blue-500 dark:bg-blue-400",
  },
  wanyun: {
    rail: "from-rose-200 via-rose-300 to-amber-200 dark:from-rose-900/60 dark:via-rose-800/60 dark:to-amber-900/40",
    dot: "bg-rose-500 ring-rose-100 dark:ring-rose-950/50",
    dateText: "text-rose-500 dark:text-rose-400",
    mapPin: "text-rose-400",
    hoverBorder: "hover:border-rose-200 dark:hover:border-rose-900/70",
    fab: "bg-rose-500 hover:bg-rose-600 focus:ring-rose-200 dark:focus:ring-rose-900/50",
    tabActive: "text-rose-600 dark:text-rose-400",
    tabUnderline: "bg-rose-500 dark:bg-rose-400",
  },
};

// Convert any stored date string (display format like "August 19, 2024" OR
// an ISO "2024-08-19") into ISO `YYYY-MM-DD` for the <input type="date">
// picker. Returns "" if the string can't be parsed.
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

// Convert ISO `YYYY-MM-DD` from the date picker back into the friendly
// display format we already store on existing events ("August 19, 2024").
function fromIsoDate(iso: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  // Build with local components so the picker's date matches what shows up.
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Split a stored milestone date into "Month Day" and "Year" so the desktop
// timeline can display them stacked on the opposite side of each card.
// Handles both display format ("March 14, 2021") and ISO ("2021-03-14").
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
  // Fuzzy / un-parseable input — show as-is, no separate year.
  return { primary: s, year: "" };
}

// Dual-perspective tab bar shown inside each milestone card. The active
// perspective is owned by the parent so switching it on one card flips the
// whole page (rail color, dots, FAB, every other card) in sync. Switching
// fades the content in smoothly (via the keyframe defined in globals.css).
function PerspectiveTabs({
  event,
  perspective,
  onChange,
}: {
  event: TimelineEvent;
  perspective: Perspective;
  onChange: (p: Perspective) => void;
}) {
  const content =
    perspective === "rui" ? event.contentRui : event.contentWanyun;
  const trimmed = content.trim();
  const hasContent = trimmed.length > 0;
  const { empty } = PERSPECTIVE_LABELS[perspective];
  const accent = ACCENT[perspective];

  return (
    <div className="mt-4">
      <div
        role="tablist"
        aria-label="Perspective"
        className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800"
      >
        {(["rui", "wanyun"] as const).map((p) => {
          const active = perspective === p;
          return (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(p)}
              className={`relative -mb-px px-2 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                active
                  ? accent.tabActive
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              {PERSPECTIVE_LABELS[p].tab}
              {active && (
                <span
                  aria-hidden
                  className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full ${accent.tabUnderline}`}
                />
              )}
            </button>
          );
        })}
      </div>
      <p
        key={perspective}
        className={`mt-3 text-sm leading-relaxed animate-fade-in ${
          hasContent
            ? "text-zinc-600 dark:text-zinc-400"
            : "italic text-zinc-400 dark:text-zinc-500"
        }`}
      >
        {hasContent ? trimmed : empty}
      </p>
    </div>
  );
}

export default function LoveJourneyTimeline({
  events,
}: {
  events: TimelineEvent[];
}) {
  const router = useRouter();
  const { isJourneyAdmin } = useJourneyAdmin();

  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // Active perspective is page-level: flipping the tab on any card switches
  // every card, the rail color, the dots, and the FAB in sync.
  const [perspective, setPerspective] = useState<Perspective>("rui");
  const accent = ACCENT[perspective];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimelineEvent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const coverRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimelineEvent | null>(null);

  // Scroll-reveal. Re-observe when events change so newly added cards animate in too.
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
    setError(null);
    if (coverRef.current) coverRef.current.value = "";
    setFormOpen(true);
  };
  const openEdit = (ev: TimelineEvent) => {
    setEditing(ev);
    setForm({
      date: ev.date,
      title: ev.title,
      contentRui: ev.contentRui,
      contentWanyun: ev.contentWanyun,
      location: ev.location,
    });
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
    fd.append("content_rui", form.contentRui.trim());
    fd.append("content_wanyun", form.contentWanyun.trim());
    fd.append("location", form.location.trim());
    const cover = coverRef.current?.files?.[0];

    setBusy(true);
    setError(null);
    try {
      if (cover) {
        // Convert iPhone Live Photos / HEIC stills to JPEG so the cover
        // renders in every browser. Tag conversion errors with file info
        // so it's easier to diagnose iOS-Chrome edge cases on screen.
        if (isHeic(cover)) setConverting(true);
        try {
          const ready = await prepareImageForUpload(cover);
          fd.append("cover", ready);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(
            `Convert failed — ${cover.name || "?"}, ` +
              `${(cover.size / 1024 / 1024).toFixed(1)}MB, ` +
              `${cover.type || "no MIME"}: ${msg}`,
          );
        }
        setConverting(false);
      }

      let res: Response;
      try {
        res = await fetch(
          editing ? `/api/timeline/${editing.id}` : "/api/timeline",
          { method: editing ? "PATCH" : "POST", body: fd },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Network error: ${msg}`);
      }

      // Read body as text first so we can surface non-JSON errors (e.g. a
      // 413 from Vercel's body-size limit returns HTML, not JSON).
      const bodyText = await res.text().catch(() => "");
      let data: { error?: string } | null = null;
      try {
        data = JSON.parse(bodyText);
      } catch {
        /* leave data as null */
      }

      if (res.ok) {
        setFormOpen(false);
        if (coverRef.current) coverRef.current.value = "";
        router.refresh();
      } else {
        setError(
          `Server ${res.status}: ${
            data?.error || bodyText.slice(0, 200) || "(no body)"
          }`,
        );
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
        {/* Central path (color follows the active perspective) */}
        <div
          aria-hidden
          className={`absolute inset-y-0 left-5 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b md:left-1/2 ${accent.rail}`}
        />

        {events.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {isJourneyAdmin
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
                  className={`absolute left-5 top-6 z-10 size-4 -translate-x-1/2 rounded-full border-2 border-white ring-4 transition-all duration-500 ease-out md:left-1/2 dark:border-zinc-950 ${accent.dot} ${
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
                      className={`group relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-zinc-800 dark:bg-zinc-900 ${accent.hoverBorder}`}
                    >
                      {/* Edit / delete controls (admin only) */}
                      {isJourneyAdmin && (
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
                          {/* eslint-disable-next-line @next/next/no-img-element -- user cover image from Supabase Storage / placeholder */}
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
                        className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${accent.dateText}`}
                      >
                        {event.date}
                      </time>
                      <h3
                        className={`mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50 ${
                          isJourneyAdmin ? "pr-16" : ""
                        }`}
                      >
                        {event.title}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                        <MapPin
                          className={`size-3.5 shrink-0 transition-colors duration-300 ${accent.mapPin}`}
                        />
                        <span>{event.location}</span>
                      </p>
                      <PerspectiveTabs
                        event={event}
                        perspective={perspective}
                        onChange={setPerspective}
                      />
                    </article>
                  </div>
                  {/* Big date opposite the card — makes the rail feel like a real timeline. */}
                  <div className="hidden md:flex md:w-1/2 md:items-start md:px-8 md:pt-3">
                    <div
                      className={`flex-1 ${onLeft ? "text-left" : "text-right"}`}
                    >
                      <div
                        className={`text-3xl font-bold tracking-tight transition-colors duration-300 ${accent.dateText}`}
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

      {/* Floating add button (admin only) */}
      {isJourneyAdmin && (
        <button
          type="button"
          onClick={openCreate}
          aria-label="Add milestone"
          className={`fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full text-white shadow-lg transition duration-300 hover:scale-105 focus:outline-none focus:ring-4 ${accent.fab}`}
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
                    setForm((f) => ({
                      ...f,
                      date: fromIsoDate(e.target.value),
                    }))
                  }
                  className={inputClass}
                />
                {form.date && !toIsoDate(form.date) && (
                  <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">
                    Current date is “{form.date}” — pick a new one to update.
                  </span>
                )}
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

              <label className="block">
                <span className={labelText}>Rui&apos;s Perspective</span>
                <textarea
                  rows={3}
                  value={form.contentRui}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contentRui: e.target.value }))
                  }
                  placeholder="What this moment felt like for Rui…"
                  className={`${inputClass} resize-none`}
                />
              </label>

              <label className="block">
                <span className={labelText}>Wanyun&apos;s Perspective</span>
                <textarea
                  rows={3}
                  value={form.contentWanyun}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contentWanyun: e.target.value }))
                  }
                  placeholder="What this moment felt like for Wanyun…"
                  className={`${inputClass} resize-none`}
                />
                <span className="mt-1 block text-xs text-zinc-400">
                  Either side can be left blank — viewers will see a gentle
                  placeholder until the other person shares.
                </span>
              </label>

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
                <span className="mt-1 block text-xs text-zinc-400">
                  Live Photos and HEIC files are auto-converted to JPEG.
                </span>
              </label>

              {error && (
                <p className="break-words text-sm text-red-600 dark:text-red-400">{error}</p>
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
              “{deleteTarget.title}” will be permanently removed
              {deleteTarget.image ? " (along with its cover photo)" : ""}.
            </p>
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
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
