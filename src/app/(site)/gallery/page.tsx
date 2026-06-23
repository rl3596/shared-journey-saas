import PhotoGallery from "@/components/photo-gallery";
import { getAlbums } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PhotoGalleryPage() {
  const albums = await getAlbums();

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Gallery</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Our memories.</p>
      </header>
      <PhotoGallery albums={albums} />
    </section>
  );
}
