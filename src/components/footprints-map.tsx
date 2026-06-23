"use client";

import dynamic from "next/dynamic";
import type { AlbumSummary } from "@/data/gallery";

// Leaflet touches `window` on import, so the map renders client-only.
// `ssr: false` is only supported inside Client Components in Next 16,
// hence this tiny wrapper around the real map.
const GalleryMap = dynamic(() => import("./gallery-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] items-center justify-center rounded-2xl bg-zinc-50 text-sm text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:ring-zinc-800">
      Loading map…
    </div>
  ),
});

export default function FootprintsMap({ albums }: { albums: AlbumSummary[] }) {
  return <GalleryMap albums={albums} />;
}
