import "server-only";

export type Coords = { lat: number; lon: number };

/**
 * Geocode a free-form location string via OpenStreetMap's Nominatim service.
 * Returns null on no result / failure — callers should fall back gracefully
 * (e.g. create the album without coordinates).
 *
 * Nominatim usage policy: must send a descriptive User-Agent and stay under
 * 1 request/second. See https://operations.osmfoundation.org/policies/nominatim/
 */
export async function geocodeLocation(
  location: string,
): Promise<Coords | null> {
  const q = location.trim();
  if (!q) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "couples-site/1.0 (https://github.com/rl3596/couples-site)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

    return { lat, lon };
  } catch (e) {
    console.error("[geocode]:", e instanceof Error ? e.message : e);
    return null;
  }
}
