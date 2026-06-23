"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Check,
  Trash2,
  Loader2,
  CheckSquare,
  Square,
  ImagePlus,
  Map as MapIcon,
  Star,
  Pin,
} from "lucide-react";
import { setAlbumCover, togglePinAlbum } from "@/app/(site)/gallery/actions";
import { useJourneyAdmin } from "@/components/journey-admin-context";
import Lightbox, { type ControllerRef } from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import type { AlbumSummary } from "@/data/gallery";
import LocationAutocomplete from "@/components/location-autocomplete";
import { isHeic, prepareImageForUpload } from "@/lib/heic-convert";
import { formatAlbumDate, toIsoDate } from "@/lib/format-date";

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

type Progress = {
  phase: "idle" | "converting" | "creating" | "uploading";
  done: number;
  total: number;
};

function safeJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function ProgressBar({ progress }: { progress: Progress }) {
  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;
  const label =
    progress.phase === "converting"
      ? `Converting ${progress.done} of ${progress.total} Live Photos…`
      : progress.phase === "creating"
        ? "Creating event…"
        : progress.phase === "uploading"
          ? `Uploading ${progress.done} of ${progress.total} photos…`
          : "";
  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className="h-full bg-rose-500 transition-[width] duration-300 ease-out dark:bg-rose-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

// Upload files to /api/albums/[id]/photos one at a time, with limited
// concurrency. Each request carries a single photo so we stay well under
// Vercel's 4.5 MB body limit and can update progress per-file.
async function uploadPhotosWithProgress(
  albumId: string,
  files: File[],
  concurrency: number,
  onProgress: (done: number) => void,
): Promise<void> {
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= files.length) return;
      const fd = new FormData();
      fd.append("photos", files[idx]);
      const res = await fetch(`/api/albums/${albumId}/photos`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Upload failed for "${files[idx].name}" — server ${res.status}: ${
            text.slice(0, 160) || "(no body)"
          }`,
        );
      }
      done++;
      onProgress(done);
    }
  };
  const workers = Array.from(
    { length: Math.min(concurrency, files.length) },
    worker,
  );
  await Promise.all(workers);
}

export default function PhotoGallery({
  albums,
}: {
  albums: AlbumSummary[];
}) {
  const router = useRouter();

  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const activeAlbum = albums.find((a) => a.id === activeAlbumId) ?? null;

  // On-demand photo cache: each album's full URL list is fetched the first
  // time the user opens (or hovers/touches) it, then cached so subsequent
  // opens are instant. Cleared per-album whenever photos are added/removed.
  const [albumPhotos, setAlbumPhotos] = useState<Map<string, string[]>>(
    () => new Map(),
  );
  const [photosLoading, setPhotosLoading] = useState(false);
  // Track in-flight prefetches so a series of hovers doesn't spam the API.
  const prefetchingRef = useRef<Set<string>>(new Set());

  const activePhotos = activeAlbumId
    ? (albumPhotos.get(activeAlbumId) ?? null)
    : null;

  // Lightbox controller + transient toast for boundary hints.
  const lightboxRef = useRef<ControllerRef>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  // Optimistic cover override per album. The Star toggle below updates this
  // map instantly so the UI feels snappy; the server action runs in the
  // background and on success a router.refresh() pulls the new server data
  // (which matches the optimistic value).
  const [optimisticCovers, setOptimisticCovers] = useState<Map<string, string>>(
    () => new Map(),
  );

  // Hidden "admin" mode (the 5-clicks-on-the-Us-icon secret); when true,
  // every album card shows a Pin overlay so the user can pin/unpin.
  const { isJourneyAdmin } = useJourneyAdmin();

  // Optimistic pin overrides. Value is the pinned_at ISO string (or null for
  // explicitly unpinned). The albumsToRender memo below applies overrides
  // before sorting so the pin/unpin feels instant.
  const [optimisticPins, setOptimisticPins] = useState<
    Map<string, string | null>
  >(() => new Map());

  // Final album list with optimistic pin overrides applied, sorted with
  // pinned items first (pinned_at desc), then everything else by date desc.
  const albumsToRender = useMemo(() => {
    const withOverrides: AlbumSummary[] = albums.map((a) => {
      if (!optimisticPins.has(a.id)) return a;
      const next = optimisticPins.get(a.id);
      return { ...a, pinnedAt: next ?? undefined };
    });
    return withOverrides.sort((a, b) => {
      const ap = a.pinnedAt ?? null;
      const bp = b.pinnedAt ?? null;
      if (ap && bp) return bp.localeCompare(ap);
      if (ap) return -1;
      if (bp) return 1;
      return b.date.localeCompare(a.date);
    });
  }, [albums, optimisticPins]);

  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    date: string;
    endDate: string;
    location: string;
    latitude?: number;
    longitude?: number;
  }>({ title: "", date: "", endDate: "", location: "" });
  // Edit mode: clicking the single "Edit" button on an album header swaps
  // the album into edit mode — checkboxes appear on every photo, the title
  // becomes an editable input, and the controls bar changes to Add / Select
  // / Delete / Done.
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [titleDraft, setTitleDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [endDateDraft, setEndDateDraft] = useState("");
  const [titleNote, setTitleNote] = useState<string | null>(null);
  const [dateNote, setDateNote] = useState<string | null>(null);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [titleSaving, setTitleSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    phase: "idle",
    done: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteAlbum, setConfirmDeleteAlbum] = useState(false);

  const newFilesRef = useRef<HTMLInputElement>(null);
  const addFilesRef = useRef<HTMLInputElement>(null);

  const modalOpen = !!activeAlbumId || newOpen;

  // Load (or refetch) the photo list for a given album. Used by both the
  // on-open fetch and the hover prefetch path. No-op if already cached.
  const loadAlbumPhotos = (
    id: string,
    opts: { showSpinner?: boolean; force?: boolean } = {},
  ) => {
    // `force` bypasses the cache check; callers (handleAddPhotos /
    // handleDeleteSelected) need this because their setState
    // invalidations haven't applied yet when this runs — without the
    // bypass we'd early-return on the stale "still in cache" check.
    if (!opts.force) {
      if (albumPhotos.has(id)) return;
      if (prefetchingRef.current.has(id)) return;
    }
    prefetchingRef.current.add(id);
    if (opts.showSpinner) setPhotosLoading(true);
    fetch(`/api/albums/${id}/photos`)
      .then(async (res) => {
        const text = await res.text().catch(() => "");
        if (!res.ok) throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
        const data = safeJson<{ ok?: boolean; urls?: string[] }>(text);
        if (!data?.ok || !data.urls) throw new Error("Bad response");
        setAlbumPhotos((prev) => new Map(prev).set(id, data.urls!));
      })
      .catch((err) => {
        if (opts.showSpinner) {
          setError(
            `Couldn't load photos: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      })
      .finally(() => {
        prefetchingRef.current.delete(id);
        if (opts.showSpinner) setPhotosLoading(false);
      });
  };

  // When the user opens an album, ensure its photos are in the cache. The
  // fetch is deferred to a microtask so the spinner setState happens outside
  // the effect body (React 19's set-state-in-effect rule).
  useEffect(() => {
    if (!activeAlbumId) return;
    if (albumPhotos.has(activeAlbumId)) return;
    const id = activeAlbumId;
    queueMicrotask(() => loadAlbumPhotos(id, { showSpinner: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlbumId]);

  const searchParams = useSearchParams();
  const albumParam = searchParams.get("album");

  // Drop one album's cached photos so the next open re-fetches fresh.
  const invalidatePhotos = (id: string) =>
    setAlbumPhotos((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

  const openAlbum = (id: string) => {
    setActiveAlbumId(id);
    setPhotoIndex(null);
    setEditMode(false);
    setSelected(new Set());
    setTitleDraft("");
    setDateDraft("");
    setEndDateDraft("");
    setTitleNote(null);
    setDateNote(null);
    setError(null);
  };
  const closeAlbum = () => {
    setActiveAlbumId(null);
    setPhotoIndex(null);
    setEditMode(false);
    setSelected(new Set());
    setTitleDraft("");
    setDateDraft("");
    setEndDateDraft("");
    setTitleNote(null);
    setDateNote(null);
    setConfirmDeleteAlbum(false);
  };

  // Enter edit mode: seed the title + date drafts from the current album.
  // `toIsoDate` normalizes legacy free-form date strings so the native
  // <input type="date"> can pre-fill correctly.
  const enterEditMode = () => {
    if (!activeAlbum) return;
    setTitleDraft(activeAlbum.title);
    setDateDraft(toIsoDate(activeAlbum.date));
    setEndDateDraft(toIsoDate(activeAlbum.endDate ?? ""));
    setTitleNote(null);
    setDateNote(null);
    setEditMode(true);
  };

  // Exit edit mode without saving: clear in-progress drafts + selection.
  const exitEditMode = () => {
    setEditMode(false);
    setSelected(new Set());
    setTitleDraft("");
    setDateDraft("");
    setEndDateDraft("");
    setTitleNote(null);
    setDateNote(null);
  };

  // Briefly surface a validation note. Title + date notes share one timer
  // so a fresh flash always clears any leftover note.
  const clearNotes = () => {
    setTitleNote(null);
    setDateNote(null);
  };
  const flashTitleNote = (msg: string) => {
    clearNotes();
    setTitleNote(msg);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(clearNotes, 1000);
  };
  const flashDateNote = (msg: string) => {
    clearNotes();
    setDateNote(msg);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(clearNotes, 1000);
  };

  // Select-all toggle for the "Select" button inside edit mode.
  // Resolve the currently-displayed cover for the active album, preferring
  // any optimistic override that hasn't been confirmed by the server yet.
  const activeCover = activeAlbumId
    ? (optimisticCovers.get(activeAlbumId) ?? activeAlbum?.cover ?? null)
    : null;

  // Star-toggle handler: instantly flips the local cover, fires the server
  // action, and rolls back on failure.
  const handleSetCover = async (url: string) => {
    if (!activeAlbumId) return;
    if (activeCover === url) return;
    const id = activeAlbumId;
    setOptimisticCovers((prev) => new Map(prev).set(id, url));
    showToast("Cover photo updated");
    try {
      const res = await setAlbumCover(id, url);
      if (!res.ok) {
        setOptimisticCovers((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        setError(res.error ?? "Could not update cover.");
        return;
      }
      router.refresh();
    } catch (err) {
      setOptimisticCovers((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setError(err instanceof Error ? err.message : "Could not update cover.");
    }
  };

  // Pin/unpin handler: optimistically flip the local pinnedAt + show a
  // toast, fire the server action, roll back on failure.
  const handleTogglePin = async (album: AlbumSummary) => {
    const isPinned = album.pinnedAt !== undefined;
    const id = album.id;
    setOptimisticPins((prev) =>
      new Map(prev).set(id, isPinned ? null : new Date().toISOString()),
    );
    showToast(isPinned ? "Album unpinned" : "Album pinned to top");
    try {
      const res = await togglePinAlbum(id, !isPinned);
      if (!res.ok) {
        setOptimisticPins((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        setError(res.error ?? "Could not update pin.");
        return;
      }
      router.refresh();
    } catch (err) {
      setOptimisticPins((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setError(err instanceof Error ? err.message : "Could not update pin.");
    }
  };

  const toggleSelectAll = () => {
    if (!activePhotos || activePhotos.length === 0) return;
    if (selected.size === activePhotos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activePhotos));
    }
  };
  const openNew = () => {
    setForm({ title: "", date: todayISO(), endDate: "", location: "" });
    setError(null);
    setNewOpen(true);
  };

  // Open an album when arriving with ?album=<id> in the URL — used by the
  // "View album →" link inside Leaflet popups on the Footprints page.
  useEffect(() => {
    if (!albumParam) return;
    if (activeAlbumId === albumParam) return;
    if (!albums.some((a) => a.id === albumParam)) return;
    queueMicrotask(() => openAlbum(albumParam));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumParam, albums]);

  const toggleSelected = (url: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });

  // Boundary-swipe hint. YARL's finite mode rubber-bands at the edges but
  // doesn't fire a dedicated event for "swipe attempted past boundary", so
  // we listen for raw touch deltas while the lightbox is open and we're on
  // the first or last slide. The toast is also shown by the custom
  // prev/next button renderers above for the click case.
  useEffect(() => {
    if (photoIndex === null) return;
    if (!activePhotos || activePhotos.length === 0) return;
    const atFirst = photoIndex === 0;
    const atLast = photoIndex === activePhotos.length - 1;
    if (!atFirst && !atLast) return;

    let startX = 0;
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      // Require a clear horizontal swipe (≥50px, predominantly horizontal).
      if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
      if (dx < 0 && atLast) showToast("End of album reached.");
      else if (dx > 0 && atFirst) showToast("You're at the first photo.");
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [photoIndex, activePhotos]);

  // Keyboard handling for the album modal (NOT the lightbox — YARL handles
  // its own keyboard navigation and Escape internally).
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // While the lightbox is open YARL owns Escape; bail out.
      if (photoIndex !== null) return;
      if (newOpen) setNewOpen(false);
      else if (editMode) exitEditMode();
      else closeAlbum();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, photoIndex, newOpen, editMode]);

  // Lock background scroll while any modal is open.
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modalOpen]);

  // Convert any HEIC files to JPEG, reporting progress as we go. Returns the
  // ready-to-upload File array.
  async function convertAll(fileList: File[]): Promise<File[]> {
    const ready: File[] = [];
    const needsConvert = fileList.some(isHeic);
    if (needsConvert) {
      setProgress({ phase: "converting", done: 0, total: fileList.length });
    }
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        ready.push(await prepareImageForUpload(file));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Convert failed — ${file.name || "?"}, ` +
            `${(file.size / 1024 / 1024).toFixed(1)}MB, ` +
            `${file.type || "no MIME"}: ${msg}`,
        );
      }
      if (needsConvert) {
        setProgress({ phase: "converting", done: i + 1, total: fileList.length });
      }
    }
    return ready;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    const fileList = Array.from(newFilesRef.current?.files ?? []);

    setBusy(true);
    setError(null);
    setProgress({ phase: "idle", done: 0, total: fileList.length });

    try {
      // Phase 1: convert Live Photos / HEIC to JPEG.
      const ready = await convertAll(fileList);

      // Phase 2: create the album with metadata only (instant). We upload
      // photos in a separate phase so we can show per-file progress and
      // each request stays under Vercel's 4.5 MB body limit.
      setProgress({ phase: "creating", done: 0, total: fileList.length });
      const meta = new FormData();
      meta.append("title", form.title.trim());
      meta.append("date", form.date);
      if (form.endDate && form.endDate !== form.date) {
        meta.append("end_date", form.endDate);
      }
      meta.append("location", form.location.trim());
      if (form.latitude !== undefined && form.longitude !== undefined) {
        meta.append("latitude", String(form.latitude));
        meta.append("longitude", String(form.longitude));
      }
      const createRes = await fetch("/api/albums", {
        method: "POST",
        body: meta,
      }).catch((err) => {
        throw new Error(
          `Network error: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
      const createText = await createRes.text().catch(() => "");
      const createData = safeJson<{ ok?: boolean; album?: { id: string }; error?: string }>(createText);
      if (!createRes.ok || !createData?.album?.id) {
        throw new Error(
          `Server ${createRes.status}: ${
            createData?.error || createText.slice(0, 200) || "(no body)"
          }`,
        );
      }
      const albumId = createData.album.id;

      // Phase 3: upload photos with concurrency 3, one photo per request.
      if (ready.length > 0) {
        setProgress({ phase: "uploading", done: 0, total: ready.length });
        await uploadPhotosWithProgress(albumId, ready, 3, (done) =>
          setProgress({ phase: "uploading", done, total: ready.length }),
        );
      }

      setNewOpen(false);
      if (newFilesRef.current) newFilesRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setProgress({ phase: "idle", done: 0, total: 0 });
    setBusy(false);
  }

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeAlbumId) return;
    const fileList = Array.from(files);

    setBusy(true);
    setError(null);
    setProgress({ phase: "idle", done: 0, total: fileList.length });

    try {
      const ready = await convertAll(fileList);
      setProgress({ phase: "uploading", done: 0, total: ready.length });
      await uploadPhotosWithProgress(activeAlbumId, ready, 3, (done) =>
        setProgress({ phase: "uploading", done, total: ready.length }),
      );
      // Cached photo list is now stale — drop it so the modal re-fetches.
      // `force: true` bypasses the stale "still in cache" check (the
      // setState from invalidatePhotos hasn't applied yet at this point).
      invalidatePhotos(activeAlbumId);
      loadAlbumPhotos(activeAlbumId, { showSpinner: true, force: true });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setProgress({ phase: "idle", done: 0, total: 0 });
    setBusy(false);
    if (addFilesRef.current) addFilesRef.current.value = "";
  }

  async function handleDeleteSelected() {
    if (!activeAlbumId || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${activeAlbumId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: Array.from(selected) }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSelected(new Set());
        setEditMode(false);
        invalidatePhotos(activeAlbumId);
        loadAlbumPhotos(activeAlbumId, { showSpinner: true, force: true });
        router.refresh();
      } else {
        setError(data?.error ?? "Could not delete photos.");
      }
    } catch {
      setError("Delete failed. Please try again.");
    }
    setBusy(false);
  }

  async function handleDeleteAlbum() {
    if (!activeAlbumId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${activeAlbumId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        closeAlbum();
        router.refresh();
      } else {
        setError(data?.error ?? "Could not delete the album.");
      }
    } catch {
      setError("Delete failed. Please try again.");
    }
    setBusy(false);
  }

  // "Done" exits edit mode. If the title was changed, PATCH it first. An
  // empty title triggers a 1-second toast on the title input and aborts.
  async function handleDone() {
    if (!activeAlbum || !activeAlbumId) return;

    const trimmedTitle = titleDraft.trim();
    if (trimmedTitle === "") {
      flashTitleNote("Album name should not be empty.");
      return;
    }
    if (dateDraft === "") {
      flashDateNote("Start date should not be empty.");
      return;
    }
    if (endDateDraft && endDateDraft < dateDraft) {
      flashDateNote("End date must be on or after start date.");
      return;
    }

    // Detect what actually changed so the PATCH body stays minimal.
    const currentDateIso = toIsoDate(activeAlbum.date);
    const currentEndDateIso = toIsoDate(activeAlbum.endDate ?? "");
    const body: Record<string, string | null> = {};
    if (trimmedTitle !== activeAlbum.title) body.title = trimmedTitle;
    if (dateDraft !== currentDateIso) body.date = dateDraft;
    if (endDateDraft !== currentEndDateIso) {
      // Empty end date clears the column; otherwise persist the new value.
      body.end_date = endDateDraft === "" ? null : endDateDraft;
    }

    if (Object.keys(body).length === 0) {
      exitEditMode();
      return;
    }

    setTitleSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${activeAlbumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        exitEditMode();
        router.refresh();
      } else {
        setError(data?.error ?? "Could not save the album.");
      }
    } catch {
      setError("Save failed. Please try again.");
    }
    setTitleSaving(false);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {albums.length} {albums.length === 1 ? "album" : "albums"}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/gallery/footprints"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <MapIcon className="size-4" />
            Footprints
          </Link>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600"
          >
            <Plus className="size-4" />
            New Event
          </button>
        </div>
      </div>

      {/* Album cover grid */}
      {albumsToRender.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No albums yet — tap “New Event” to create your first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {albumsToRender.map((album, index) => {
            const isPinned = album.pinnedAt !== undefined;
            // Pin overlay is interactive when the hidden admin mode is on;
            // otherwise it's a small read-only badge that only appears on
            // pinned albums so casual viewers know what's at the top.
            const showPin = isJourneyAdmin || isPinned;
            return (
              <button
                key={album.id}
                type="button"
                onClick={() => openAlbum(album.id)}
                onPointerEnter={() => loadAlbumPhotos(album.id)}
                onFocus={() => loadAlbumPhotos(album.id)}
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-rose-100 to-amber-100 text-left shadow-sm ring-1 ring-zinc-200 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl dark:from-rose-950/40 dark:to-amber-950/30 dark:ring-zinc-800"
              >
                {album.cover ? (
                  <Image
                    src={album.cover}
                    alt={album.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    // Priority for the first 3 covers above the fold — the
                    // rest lazy-load by default. Next/image also serves
                    // WebP/AVIF.
                    priority={index < 3}
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Pin overlay (top-left). Span instead of a real button so
                    it can sit inside the album-card button without
                    nesting buttons. */}
                {showPin && (
                  <span
                    role={isJourneyAdmin ? "button" : undefined}
                    tabIndex={isJourneyAdmin ? 0 : undefined}
                    aria-label={
                      isJourneyAdmin
                        ? isPinned
                          ? "Unpin album"
                          : "Pin album"
                        : "Pinned album"
                    }
                    title={
                      isJourneyAdmin
                        ? isPinned
                          ? "Unpin"
                          : "Pin to top"
                        : "Pinned"
                    }
                    onClick={
                      isJourneyAdmin
                        ? (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleTogglePin(album);
                          }
                        : undefined
                    }
                    onKeyDown={
                      isJourneyAdmin
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              handleTogglePin(album);
                            }
                          }
                        : undefined
                    }
                    className={`absolute left-2 top-2 inline-flex items-center justify-center rounded-full bg-black/50 p-1.5 backdrop-blur-sm transition-colors ${
                      isJourneyAdmin
                        ? "cursor-pointer hover:bg-black/70"
                        : ""
                    }`}
                  >
                    <Pin
                      className={`size-4 ${
                        isPinned
                          ? "fill-rose-400 text-rose-400"
                          : "text-white drop-shadow"
                      }`}
                    />
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {album.title}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                    <MapPin className="size-3.5 shrink-0" />
                    <span>{album.location}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-white/70">
                    {formatAlbumDate(album.date, album.endDate)} &middot;{" "}
                    {album.photoCount} photos
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Album modal */}
      {activeAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeAlbum}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activeAlbum.title}
            className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
          >
            <header className="flex shrink-0 flex-col gap-3 border-b border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {editMode ? (
                    <div>
                      <input
                        type="text"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleDone();
                          }
                        }}
                        aria-label="Album name"
                        placeholder="Album name"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xl font-semibold tracking-tight text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-rose-500 dark:focus:ring-rose-900/50"
                      />
                      {titleNote && (
                        <p
                          role="status"
                          aria-live="polite"
                          className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400"
                        >
                          {titleNote}
                        </p>
                      )}
                    </div>
                  ) : (
                    <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {activeAlbum.title}
                    </h2>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5 text-rose-400" />
                      {activeAlbum.location}
                    </span>
                    {!editMode && (
                      <span>
                        {formatAlbumDate(activeAlbum.date, activeAlbum.endDate)}
                      </span>
                    )}
                    <span>{activeAlbum.photoCount} photos</span>
                  </p>

                  {editMode && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Start date
                        </span>
                        <input
                          type="date"
                          value={dateDraft}
                          onChange={(e) => setDateDraft(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-rose-500 dark:focus:ring-rose-900/50"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          End date{" "}
                          <span className="font-normal text-zinc-400">
                            (optional)
                          </span>
                        </span>
                        <input
                          type="date"
                          value={endDateDraft}
                          min={dateDraft || undefined}
                          onChange={(e) => setEndDateDraft(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-rose-500 dark:focus:ring-rose-900/50"
                        />
                      </label>
                      {dateNote && (
                        <p
                          role="status"
                          aria-live="polite"
                          className="text-xs font-medium text-rose-600 sm:col-span-2 dark:text-rose-400"
                        >
                          {dateNote}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeAlbum}
                  aria-label="Close album"
                  className="shrink-0 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Manage controls. View mode shows a single Edit affordance;
                  edit mode swaps in the full Add / Select / Delete / Done bar
                  with the album-delete icon button kept off to the side. */}
              <div className="flex flex-wrap items-center gap-2">
                {!editMode ? (
                  <button
                    type="button"
                    onClick={enterEditMode}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="size-4" />
                    Edit
                  </button>
                ) : (
                  <>
                    {/* Add — opens the hidden file input. */}
                    <label
                      className={`inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 ${
                        busy ? "cursor-wait opacity-70" : "cursor-pointer"
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ImagePlus className="size-4" />
                      )}
                      {progress.phase === "converting"
                        ? `Converting ${progress.done} / ${progress.total}…`
                        : progress.phase === "uploading"
                          ? `Uploading ${progress.done} / ${progress.total}…`
                          : busy
                            ? "Uploading…"
                            : "Add"}
                      <input
                        ref={addFilesRef}
                        type="file"
                        accept="image/*,.heic,.heif"
                        multiple
                        className="hidden"
                        onChange={handleAddPhotos}
                        disabled={busy}
                      />
                    </label>

                    {/* Select all / Clear toggle. */}
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      disabled={
                        busy || !activePhotos || activePhotos.length === 0
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <CheckSquare className="size-4" />
                      {activePhotos &&
                      activePhotos.length > 0 &&
                      selected.size === activePhotos.length
                        ? "Clear"
                        : "Select"}
                    </button>

                    {/* Delete — muted red when nothing selected, vivid when
                        one or more photos are checked. */}
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      disabled={busy || selected.size === 0}
                      aria-label={
                        selected.size === 0
                          ? "Delete (no photos selected)"
                          : `Delete ${selected.size} selected ${
                              selected.size === 1 ? "photo" : "photos"
                            }`
                      }
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                        selected.size === 0
                          ? "border border-red-200 text-red-300 dark:border-red-900/40 dark:text-red-900"
                          : "bg-red-500 text-white hover:bg-red-600"
                      }`}
                    >
                      <Trash2 className="size-4" />
                      Delete{selected.size > 0 ? ` (${selected.size})` : ""}
                    </button>

                    {/* Done — validate title and exit edit mode. */}
                    <button
                      type="button"
                      onClick={handleDone}
                      disabled={busy || titleSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
                    >
                      {titleSaving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Done
                    </button>

                    {busy && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                        <Loader2 className="size-4 animate-spin" />
                        Working…
                      </span>
                    )}

                    {/* Delete entire album — icon-only, visually separated. */}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAlbum(true)}
                      aria-label="Delete album"
                      title="Delete album"
                      className="ml-auto inline-flex items-center justify-center rounded-lg border border-red-200 p-1.5 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
              {progress.phase !== "idle" && progress.total > 0 && (
                <ProgressBar progress={progress} />
              )}
              {error && (
                <p className="break-words text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {activePhotos === null && photosLoading ? (
                <div className="flex h-64 items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="size-5 animate-spin text-rose-500" />
                  Loading photos…
                </div>
              ) : activePhotos === null ? (
                // Cache miss without loading — likely a fetch error. The error
                // message is already shown in the header.
                <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Couldn&apos;t load photos for this album.
                </div>
              ) : activePhotos.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No photos yet — use &ldquo;Add photos&rdquo; above.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {activePhotos.map((url, i) => {
                    const isSelected = selected.has(url);
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() =>
                          editMode ? toggleSelected(url) : setPhotoIndex(i)
                        }
                        aria-label={editMode ? "Select photo" : `View photo ${i + 1}`}
                        className={`group relative aspect-square overflow-hidden rounded-lg bg-zinc-100 ring-2 transition dark:bg-zinc-800 ${
                          editMode && isSelected
                            ? "ring-rose-500"
                            : "ring-transparent"
                        }`}
                      >
                        <Image
                          src={url}
                          alt={`${activeAlbum.title} photo ${i + 1}`}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                          className={`object-cover transition duration-300 ease-out group-hover:scale-105 ${
                            editMode && isSelected ? "opacity-70" : ""
                          }`}
                        />
                        {editMode && (
                          <span className="absolute right-1.5 top-1.5 rounded bg-white/90 text-rose-600 dark:bg-zinc-900/90">
                            {isSelected ? (
                              <CheckSquare className="size-5" />
                            ) : (
                              <Square className="size-5 text-zinc-400" />
                            )}
                          </span>
                        )}
                        {editMode && (
                          // Cover-photo toggle. stopPropagation so it doesn't
                          // also toggle the selection checkbox on click.
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetCover(url);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSetCover(url);
                              }
                            }}
                            aria-label={
                              url === activeCover
                                ? "Current cover photo"
                                : "Set as cover photo"
                            }
                            title={
                              url === activeCover
                                ? "Current cover photo"
                                : "Set as cover photo"
                            }
                            className={`absolute left-1.5 top-1.5 inline-flex cursor-pointer items-center justify-center rounded-full bg-black/45 p-1.5 backdrop-blur-sm transition-colors hover:bg-black/65 ${
                              url === activeCover ? "ring-1 ring-amber-300" : ""
                            }`}
                          >
                            <Star
                              className={`size-4 ${
                                url === activeCover
                                  ? "fill-amber-300 text-amber-300"
                                  : "text-white drop-shadow"
                              }`}
                            />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gesture-driven lightbox (yet-another-react-lightbox). Swipe on
          mobile / trackpad slides between photos with native physics; arrow
          keys + click work on desktop. Finite carousel so the rubber-band
          snap-back at the edges signals "you're at the end". */}
      {activeAlbum && activePhotos && !editMode && (
        <Lightbox
          open={photoIndex !== null}
          close={() => setPhotoIndex(null)}
          index={photoIndex ?? 0}
          slides={activePhotos.map((url) => ({ src: url }))}
          carousel={{ finite: true, preload: 2 }}
          animation={{ fade: 250, swipe: 400 }}
          controller={{ ref: lightboxRef, closeOnBackdropClick: true }}
          plugins={[Counter]}
          counter={{ container: { style: { bottom: "1rem", top: "auto" } } }}
          on={{
            view: ({ index }) => setPhotoIndex(index),
          }}
          render={{
            iconPrev: () => <ChevronLeft className="size-8" />,
            iconNext: () => <ChevronRight className="size-8" />,
            buttonPrev:
              photoIndex === 0
                ? () => (
                    <button
                      type="button"
                      aria-label="First photo"
                      onClick={() => showToast("You're at the first photo.")}
                      className="yarl__button"
                    >
                      <ChevronLeft className="size-8" />
                    </button>
                  )
                : undefined,
            buttonNext:
              photoIndex !== null && photoIndex === activePhotos.length - 1
                ? () => (
                    <button
                      type="button"
                      aria-label="Last photo"
                      onClick={() => showToast("End of album reached.")}
                      className="yarl__button"
                    >
                      <ChevronRight className="size-8" />
                    </button>
                  )
                : undefined,
          }}
        />
      )}

      {/* Transient boundary hint — sits above the lightbox (z-[10000] beats
          YARL's default z-9999) and auto-dismisses after a couple seconds. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-10 left-1/2 z-[10000] -translate-x-1/2 rounded-full bg-black/85 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm"
        >
          {toast}
        </div>
      )}

      {/* New Event modal */}
      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !busy && setNewOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New event"
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                New Event
              </h2>
              <button
                type="button"
                onClick={() => !busy && setNewOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <label className="block">
                <span className={labelText}>Event name</span>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Fourth Anniversary"
                  className={inputClass}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelText}>Start date</span>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelText}>
                    End date{" "}
                    <span className="font-normal text-zinc-400">(optional)</span>
                  </span>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.date || undefined}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelText}>Location</span>
                <LocationAutocomplete
                  value={form.location}
                  onChange={(loc) =>
                    setForm((f) => ({
                      ...f,
                      location: loc.location,
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    }))
                  }
                  placeholder="e.g. Eiffel Tower, Paris"
                />
              </label>

              <label className="block">
                <span className={labelText}>Photos</span>
                <input
                  ref={newFilesRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-rose-600 hover:file:bg-rose-100 dark:text-zinc-400 dark:file:bg-rose-950/40 dark:file:text-rose-300"
                />
                <span className="mt-1 block text-xs text-zinc-400">
                  You can select multiple photos. Live Photos and HEIC files
                  are auto-converted to JPEG on upload.
                </span>
              </label>

              {progress.phase !== "idle" && progress.total > 0 && (
                <ProgressBar progress={progress} />
              )}

              {error && (
                <p className="break-words text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => !busy && setNewOpen(false)}
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
                  {progress.phase === "converting"
                    ? `Converting ${progress.done} / ${progress.total}…`
                    : progress.phase === "uploading"
                      ? `Uploading ${progress.done} / ${progress.total}…`
                      : busy
                        ? "Creating…"
                        : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm deleting the entire album */}
      {activeAlbum && confirmDeleteAlbum && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !busy && setConfirmDeleteAlbum(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete album"
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Delete this album?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              “{activeAlbum.title}” and all {activeAlbum.photoCount} of its
              photos will be permanently removed.
            </p>
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !busy && setConfirmDeleteAlbum(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAlbum}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? "Deleting…" : "Delete album"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
