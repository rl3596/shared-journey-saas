"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";

const SLIDE_DURATION_MS = 10_000;
const FADE_DURATION_MS = 800;

export default function DailySlideshow({ photos }: { photos: string[] }) {
  const [rawIdx, setIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  // Clamp at render time so an out-of-range index from a stale state can't
  // crash the slide map. (Cheaper and lint-clean compared with a "snap back
  // to 0" effect that would trip the set-state-in-effect rule.)
  const idx = photos.length === 0 ? 0 : rawIdx % photos.length;

  // Auto-advance every 30 s, paused while the lightbox is open or there's
  // nothing to cycle through.
  useEffect(() => {
    if (lightboxOpen || photos.length <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % photos.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(id);
  }, [photos.length, lightboxOpen]);

  if (photos.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No photos yet — add your first album.
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLightboxIdx(idx);
          setLightboxOpen(true);
        }}
        aria-label="Open today's photos in full screen"
        className="group relative block h-full w-full overflow-hidden rounded-2xl bg-black ring-1 ring-zinc-200 dark:ring-zinc-800"
      >
        {/* All photos mounted as absolutely-positioned layers. CSS opacity
            transition handles the crossfade automatically when `idx`
            changes; whichever layer is at opacity 1 wins. */}
        {photos.map((url, i) => (
          <Image
            key={url}
            src={url}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            // Priority on the first frame so the dashboard's largest above-
            // fold image isn't behind a lazy-load. The rest stream in.
            priority={i === 0}
            // object-contain so portrait photos aren't cropped — they sit
            // inside the landscape container with black bars on the sides.
            // Next.js Image with `fill` defaults to object-position: 50% 50%
            // so the image is automatically centered.
            className={`object-contain transition-opacity ease-in-out ${
              i === idx ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
          />
        ))}

        {/* Subtle gradient strip behind the progress bar for contrast on
            light photos. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/35 to-transparent"
        />

        {/* Progress bar — re-mounts on every `idx` change (via `key`), which
            restarts the slideshow-fill keyframe from 0%. The inner bar is
            full width and grows via `transform: scaleX` from left to right
            so the keyframe doesn't have to deal with `width: auto`. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
          <div
            key={idx}
            className="h-full w-full origin-left bg-white/95"
            style={{
              animation: `slideshow-fill ${SLIDE_DURATION_MS}ms linear both`,
              animationPlayState: lightboxOpen ? "paused" : "running",
            }}
          />
        </div>
      </button>

      {/* Full-screen lightbox cycling through today's set only. */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIdx}
        slides={photos.map((url) => ({ src: url }))}
        carousel={{ finite: true, preload: 2 }}
        animation={{ fade: 250, swipe: 400 }}
        controller={{ closeOnBackdropClick: true }}
        plugins={[Counter]}
        on={{ view: ({ index }) => setLightboxIdx(index) }}
      />
    </>
  );
}
