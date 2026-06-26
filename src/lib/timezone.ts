/**
 * Time-zone helpers for schedule events. Pure functions — safe on the server
 * and in client components. An event stores a wall-clock `date`/`time` plus the
 * IANA `timezone` it was entered in; these turn that into a real instant so we
 * can render it in any viewer's local zone.
 */

/** Offset (ms) of `timeZone` from UTC at a given instant: zoneWall − utc. */
function zoneOffsetMs(timeZone: string, atUtcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(atUtcMs))) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  const asUTC = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour % 24,
    map.minute,
    map.second,
  );
  return asUTC - atUtcMs;
}

/**
 * The UTC instant (ms) for a wall-clock `date`/`time` interpreted in `timeZone`.
 * When `timeZone` is empty/undefined, the wall time is treated as UTC (legacy
 * rows have no zone — callers pass the viewer's zone as a fallback).
 */
export function eventInstantMs(
  date: string,
  time: string,
  timeZone?: string,
): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = (time || "00:00").split(":").map(Number);
  if (!y || !mo || !d) return NaN;
  const wallAsUTC = Date.UTC(y, mo - 1, d, h || 0, mi || 0, 0);
  if (!timeZone) return wallAsUTC;
  return wallAsUTC - zoneOffsetMs(timeZone, wallAsUTC);
}

/** "3:00 PM" for an instant rendered in a zone. */
export function formatTimeInZone(instantMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instantMs));
}

/** "Jul 1" for an instant rendered in a zone. */
export function formatDateInZone(instantMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(new Date(instantMs));
}

/** Short zone label for an instant, e.g. "EST", "GMT+8". */
export function zoneAbbrev(instantMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    timeZoneName: "short",
  }).formatToParts(new Date(instantMs));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** YYYY-MM-DD calendar day of an instant in a zone (for day-shift detection). */
export function dayKeyInZone(instantMs: number, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instantMs));
}

/** The runtime's IANA time zone (browser local on the client). */
export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Turn "America/New_York" into a friendlier "America / New York". */
export function prettyZone(tz: string): string {
  return tz.replace(/_/g, " ").replace(/\//g, " / ");
}

const FALLBACK_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** All IANA zones the runtime knows, or a curated fallback. */
export function allTimeZones(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf;
  if (typeof supported === "function") {
    try {
      return supported("timeZone");
    } catch {
      /* fall through */
    }
  }
  return FALLBACK_ZONES;
}
