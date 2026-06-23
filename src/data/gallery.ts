export type Album = {
  id: string;
  title: string;
  location: string;
  /** Start date — single-day events use only this. */
  date: string;
  /** Optional last day for multi-day events. */
  endDate?: string;
  imageUrls: string[];
  /** Geocoded coordinates of `location` (undefined if not geocoded yet). */
  latitude?: number;
  longitude?: number;
};

/**
 * Lightweight album shape used in the gallery list view. Carries only the
 * cover URL + photo count instead of every photo URL, so the gallery
 * server-rendered payload stays tiny and the browser doesn't kick off
 * downloads for photos the user hasn't asked to see yet.
 */
export type AlbumSummary = {
  id: string;
  title: string;
  location: string;
  date: string;
  endDate?: string;
  /** First image URL — used as the card cover. Undefined for empty albums. */
  cover?: string;
  /** Total number of photos in the album. */
  photoCount: number;
  /** ISO timestamp when the album was pinned; undefined if not pinned. */
  pinnedAt?: string;
  latitude?: number;
  longitude?: number;
};

// Placeholder photos. Swap these picsum URLs for your own image paths later
// (e.g. "/gallery/anniversary/01.jpg" placed in the public/ folder).
const photos = (seed: string, count: number): string[] =>
  Array.from(
    { length: count },
    (_, i) => `https://picsum.photos/seed/${seed}-${i + 1}/900/900`,
  );

export const albums: Album[] = [
  {
    id: "third-anniversary",
    title: "Third Anniversary",
    location: "Shanghai Disney Resort",
    date: "August 19, 2024",
    imageUrls: photos("anniversary", 8),
  },
  {
    id: "cherry-blossoms",
    title: "Cherry Blossom Trip",
    location: "Kyoto, Japan",
    date: "April 5, 2024",
    imageUrls: photos("kyoto", 6),
  },
  {
    id: "beach-days",
    title: "Beach Days",
    location: "Bali, Indonesia",
    date: "February 14, 2024",
    imageUrls: photos("bali", 7),
  },
  {
    id: "birthday-weekend",
    title: "Her Birthday Weekend",
    location: "Tokyo, Japan",
    date: "November 2, 2023",
    imageUrls: photos("tokyo", 6),
  },
  {
    id: "first-snow",
    title: "First Snow Together",
    location: "Hokkaido, Japan",
    date: "December 24, 2023",
    imageUrls: photos("hokkaido", 5),
  },
  {
    id: "hometown-visit",
    title: "Hometown Visit",
    location: "Chengdu, China",
    date: "October 1, 2023",
    imageUrls: photos("chengdu", 6),
  },
];
