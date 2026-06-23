"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { MapPin } from "lucide-react";
import type { AlbumSummary } from "@/data/gallery";
import { formatAlbumDate } from "@/lib/format-date";

type AlbumWithCoords = AlbumSummary & { latitude: number; longitude: number };

// Custom Leaflet icon: the album's cover photo inside a small circular div.
function makeCoverIcon(coverUrl: string | undefined, title: string): L.DivIcon {
  const altSafe = title.replace(/"/g, "&quot;");
  const srcSafe = (coverUrl ?? "").replace(/"/g, "%22");
  const inner = coverUrl
    ? `<img src="${srcSafe}" alt="${altSafe}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
    : "";

  return L.divIcon({
    className: "couples-cover-marker",
    html: `<div style="width:48px;height:48px;border-radius:9999px;overflow:hidden;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);background:linear-gradient(135deg,#fecaca,#fde68a);cursor:pointer;">${inner}</div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
  });
}

type Props = {
  albums: AlbumSummary[];
};

export default function GalleryMap({ albums }: Props) {
  const placed: AlbumWithCoords[] = albums.filter(
    (a): a is AlbumWithCoords =>
      typeof a.latitude === "number" && typeof a.longitude === "number",
  );

  // Initial view: fit bounds when we have multiple markers; otherwise center
  // on the one we have (or a sensible world view if there are none).
  const center: [number, number] =
    placed.length > 0 ? [placed[0].latitude, placed[0].longitude] : [20, 0];
  const zoom = placed.length === 1 ? 6 : 2;
  const bounds: L.LatLngBoundsExpression | undefined =
    placed.length > 1
      ? [
          [
            Math.min(...placed.map((a) => a.latitude)),
            Math.min(...placed.map((a) => a.longitude)),
          ],
          [
            Math.max(...placed.map((a) => a.latitude)),
            Math.max(...placed.map((a) => a.longitude)),
          ],
        ]
      : undefined;

  return (
    <div className="relative isolate h-[70vh] overflow-hidden rounded-2xl ring-1 ring-zinc-200 dark:ring-zinc-800">
      <MapContainer
        center={center}
        zoom={zoom}
        bounds={bounds}
        boundsOptions={{ padding: [40, 40] }}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {placed.map((album) => (
          <Marker
            key={album.id}
            position={[album.latitude, album.longitude]}
            icon={makeCoverIcon(album.cover, album.title)}
          >
            <Popup>
              <div className="w-56">
                {album.cover && (
                  // eslint-disable-next-line @next/next/no-img-element -- inside a Leaflet popup portal; plain img keeps the popup self-contained
                  <img
                    src={album.cover}
                    alt={album.title}
                    className="aspect-[4/3] w-full rounded-md object-cover"
                  />
                )}
                <h3 className="mt-2 text-base font-semibold text-zinc-900">
                  {album.title}
                </h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-600">
                  <MapPin className="size-3 shrink-0 text-rose-400" />
                  <span>{album.location}</span>
                </p>
                <p className="text-xs text-zinc-600">
                  {formatAlbumDate(album.date, album.endDate)}
                </p>
                <Link
                  href={`/gallery?album=${album.id}`}
                  className="mt-2 inline-block text-sm font-medium text-rose-600 hover:text-rose-700"
                >
                  View album →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {placed.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-white/95 px-3 py-1.5 text-xs text-zinc-600 shadow dark:bg-zinc-900/95 dark:text-zinc-300">
          No albums have a known location yet — create one with a location to drop it on the map.
        </div>
      )}
    </div>
  );
}
