// Display helpers for album dates / date-ranges. Pure functions — safe to
// import from either a Client or a Server Component.

function parseIso(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Normalize a stored date string into the ISO `YYYY-MM-DD` form expected by
 * `<input type="date">`. Handles strings already in ISO as well as
 * free-form display strings like "August 19, 2024". Returns "" if the
 * string can't be parsed.
 */
export function toIsoDate(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatOne(s: string): string {
  const d = parseIso(s);
  if (!d) return s; // Already a free-form string like "August 19, 2024" — show as-is.
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Render an album's date or date-range for display. Single-day events show
 * one date; multi-day events show "Mar 5 – Mar 9, 2026" (same year) or
 * "Dec 28, 2025 – Jan 3, 2026" (cross-year).
 */
export function formatAlbumDate(start: string, end?: string): string {
  if (!end || end === start) return formatOne(start);
  const a = parseIso(start);
  const b = parseIso(end);
  if (!a || !b) return `${formatOne(start)} – ${formatOne(end)}`;
  const sameYear = a.getFullYear() === b.getFullYear();
  const startOpts: Intl.DateTimeFormatOptions = sameYear
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" };
  return `${a.toLocaleDateString("en-US", startOpts)} – ${b.toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  )}`;
}
