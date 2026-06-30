"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { StickyNote, X, Plus, Trash2, Minus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type View = "hidden" | "collapsed" | "expanded";

type Note = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  color: string;
  createdAt: string;
};

const COLORS: Record<string, string> = {
  amber: "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",
  rose: "border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30",
  sky: "border-sky-300 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/30",
  emerald: "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30",
  violet: "border-violet-300 bg-violet-50 dark:border-violet-900/60 dark:bg-violet-950/30",
};
const DOTS: Record<string, string> = {
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
  violet: "bg-violet-400",
};
const COLOR_KEYS = Object.keys(COLORS);

// rose-500 glow. A 3-stop keyframe makes unread notes pulse.
const GLOW_PULSE = [
  "0 0 8px 0px rgba(244,63,94,0.45)",
  "0 0 18px 2px rgba(244,63,94,0.80)",
  "0 0 8px 0px rgba(244,63,94,0.45)",
];
const GLOW_NONE = "0 0 0px 0px rgba(244,63,94,0)";

/** Notes live only on space-scoped routes, not on global multi-tenant pages. */
function isSpaceRoute(p: string): boolean {
  return (
    p === "/" ||
    p.startsWith("/love-journey") ||
    p.startsWith("/gallery") ||
    p.startsWith("/schedule")
  );
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function MiniAvatar({ url, name }: { url: string | null; name: string }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary avatar URL
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        (name[0] ?? "·").toUpperCase()
      )}
    </span>
  );
}

function NoteCard({
  note,
  isUnread,
  mine,
  onDismiss,
  onDelete,
}: {
  note: Note;
  isUnread: boolean;
  mine: boolean;
  onDismiss: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.96 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        boxShadow: isUnread ? GLOW_PULSE : GLOW_NONE,
      }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{
        layout: { type: "spring", stiffness: 500, damping: 40 },
        boxShadow: isUnread
          ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.5 },
        default: { duration: 0.2 },
      }}
      onClick={isUnread ? onDismiss : undefined}
      className={`rounded-xl border p-3 ${COLORS[note.color] ?? COLORS.amber} ${
        isUnread ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <MiniAvatar url={note.authorAvatar} name={note.authorName} />
          <span className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {mine ? "You" : note.authorName}
          </span>
          <span className="shrink-0 text-[10px] text-zinc-400">
            · {relativeTime(note.createdAt)}
          </span>
        </div>
        {mine && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete note"
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-black/5 hover:text-red-600 dark:hover:bg-white/10 dark:hover:text-red-400"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-100">
        {note.content}
      </p>
    </motion.div>
  );
}

export default function SpaceNotesBoard(props: {
  spaceId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
}) {
  // Remount on space change → wipes notes/unread, tears down the old channel,
  // and re-fetches + re-subscribes for the new space.
  return <SpaceNotesInner key={props.spaceId} {...props} />;
}

function SpaceNotesInner({
  spaceId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
}: {
  spaceId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
}) {
  const pathname = usePathname();
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [pendingDot, setPendingDot] = useState(false);
  const [view, setView] = useState<View>("collapsed");
  const viewRef = useRef<View>("collapsed");
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState("amber");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const namesRef = useRef(new Map<string, { name: string; avatar: string | null }>());

  const setViewBoth = (v: View) => {
    viewRef.current = v;
    setView(v);
  };
  const expand = () => {
    setViewBoth("expanded");
    setPendingDot(false); // opening the board dismisses the red dot
  };

  // Fetch + subscribe (created here so it's client-only; never during SSR).
  useEffect(() => {
    const supabase = createClient();
    clientRef.current = supabase;
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const names = namesRef.current;
    names.set(currentUserId, { name: currentUserName, avatar: currentUserAvatar });

    const nameFromProfile = (p: {
      username?: string | null;
      handle?: string | null;
    }) => p.username?.trim() || (p.handle ? `@${p.handle}` : "Member");

    const enrich = (r: Record<string, unknown>): Note => {
      const info = names.get(r.author_id as string);
      return {
        id: r.id as string,
        authorId: r.author_id as string,
        authorName: info?.name ?? "Member",
        authorAvatar: info?.avatar ?? null,
        content: (r.content as string) ?? "",
        color: (r.color as string) ?? "amber",
        createdAt: r.created_at as string,
      };
    };

    const ensureName = async (id: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,handle,avatar_url")
        .eq("id", id)
        .maybeSingle();
      if (!data || !active) return;
      const name = nameFromProfile(data);
      names.set(id, { name, avatar: data.avatar_url ?? null });
      setNotes((prev) =>
        prev.map((n) =>
          n.authorId === id
            ? { ...n, authorName: name, authorAvatar: data.avatar_url ?? null }
            : n,
        ),
      );
    };

    (async () => {
      const { data: rows } = await supabase
        .from("space_notes")
        .select("id,author_id,content,color,created_at")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false });
      if (!active) return;

      const ids = [...new Set((rows ?? []).map((r) => r.author_id as string))].filter(
        (id) => !names.has(id),
      );
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,username,handle,avatar_url")
          .in("id", ids);
        for (const p of profs ?? [])
          names.set(p.id, { name: nameFromProfile(p), avatar: p.avatar_url ?? null });
      }
      if (!active) return;
      setNotes((rows ?? []).map(enrich));

      // Authorize the realtime socket so RLS applies, then subscribe.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      supabase.realtime.setAuth(session?.access_token ?? null);

      channel = supabase
        .channel(`space_notes:${spaceId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "space_notes",
            filter: `space_id=eq.${spaceId}`,
          },
          (payload) => {
            const r = payload.new as Record<string, unknown>;
            const id = r.id as string;
            setNotes((prev) =>
              prev.some((n) => n.id === id) ? prev : [enrich(r), ...prev],
            );
            if ((r.author_id as string) !== currentUserId) {
              setUnread((prev) => new Set(prev).add(id));
              if (viewRef.current !== "expanded") setPendingDot(true);
              if (!names.has(r.author_id as string)) ensureName(r.author_id as string);
            }
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [spaceId, currentUserId, currentUserName, currentUserAvatar]);

  const post = async () => {
    const supabase = clientRef.current;
    const content = draft.trim();
    if (!supabase || !content) return;
    setBusy(true);
    setErr(null);
    const id = crypto.randomUUID();
    // Optimistic add (matches the realtime echo by id, which is deduped).
    setNotes((prev) => [
      {
        id,
        authorId: currentUserId,
        authorName: currentUserName,
        authorAvatar: currentUserAvatar,
        content,
        color,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setDraft("");
    const { error } = await supabase
      .from("space_notes")
      .insert({ id, space_id: spaceId, author_id: currentUserId, content, color });
    if (error) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setErr(error.message);
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    const supabase = clientRef.current;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setUnread((prev) => {
      if (!prev.has(id)) return prev;
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
    if (supabase) await supabase.from("space_notes").delete().eq("id", id);
  };

  const markRead = (id: string) =>
    setUnread((prev) => {
      if (!prev.has(id)) return prev;
      const s = new Set(prev);
      s.delete(id);
      return s;
    });

  if (!isSpaceRoute(pathname)) return null;

  const showDot = view !== "expanded" && pendingDot;

  return (
    <div className="fixed bottom-6 left-4 z-40 md:left-[17rem]">
      <AnimatePresence mode="wait">
        {view === "expanded" ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex h-[28rem] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                <StickyNote className="size-4 text-amber-500" />
                Space Notes
              </h3>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => setViewBoth("collapsed")}
                  aria-label="Collapse"
                  className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Minus className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewBoth("hidden")}
                  aria-label="Hide notes"
                  className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {notes.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-zinc-400">
                  No notes yet. Jot the first one below.
                </p>
              ) : (
                <AnimatePresence initial={false}>
                  {notes.map((n) => (
                    <NoteCard
                      key={n.id}
                      note={n}
                      isUnread={unread.has(n.id)}
                      mine={n.authorId === currentUserId}
                      onDismiss={() => markRead(n.id)}
                      onDelete={() => remove(n.id)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>

            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Write a note for the space…"
                className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {COLOR_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setColor(k)}
                      aria-label={`${k} note`}
                      className={`size-5 rounded-full ${DOTS[k]} transition-transform ${
                        color === k
                          ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-zinc-100 dark:ring-offset-zinc-900"
                          : "hover:scale-110"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={post}
                  disabled={busy || !draft.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Post
                </button>
              </div>
              {err && (
                <p className="mt-1 break-words text-xs text-red-600 dark:text-red-400">{err}</p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-start gap-2"
          >
            {/* Stacked-deck peek */}
            {view === "collapsed" && notes.length > 0 && (
              <button
                type="button"
                onClick={expand}
                aria-label="Open space notes"
                className="relative block w-60 max-w-[calc(100vw-2rem)] text-left"
              >
                <span className="absolute -right-1.5 -top-1.5 h-full w-full rounded-xl border border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/70" />
                <span className="absolute -right-0.5 -top-0.5 h-full w-full rounded-xl border border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/90" />
                <div
                  className={`relative rounded-xl border p-3 shadow-lg ${COLORS[notes[0].color] ?? COLORS.amber}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
                      <MiniAvatar url={notes[0].authorAvatar} name={notes[0].authorName} />
                      {notes[0].authorId === currentUserId ? "You" : notes[0].authorName}
                    </span>
                    <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">
                      {notes.length} note{notes.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-100">
                    {notes[0].content}
                  </p>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={expand}
              aria-label="Space notes"
              className="relative flex size-14 items-center justify-center rounded-full bg-amber-400 text-white shadow-lg transition hover:scale-105 hover:bg-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-200 dark:focus:ring-amber-900/50"
            >
              <StickyNote className="size-6" />
              {showDot && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-950"
                >
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-500" />
                </motion.span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
