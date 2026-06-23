import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import FootprintsMap from "@/components/footprints-map";
import { getAlbums } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function FootprintsPage() {
  const albums = await getAlbums();

  return (
    <section className="space-y-6">
      <Link
        href="/gallery"
        className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 transition-colors hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400"
      >
        <ChevronLeft className="size-4" />
        Back to Gallery
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Footprints</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          The places our memories happened.
        </p>
      </header>

      <FootprintsMap albums={albums} />
    </section>
  );
}
