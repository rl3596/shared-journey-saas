// Deterministic seeded random selection. The Home dashboard's "Daily 20"
// slideshow uses this to pick a stable sample of photos for the entire
// calendar day — every viewer sees the same set, and refreshing the page
// doesn't change which photos appear.

/**
 * Pick `count` items from `items` in a stable order derived from `seedStr`.
 * The same seed always yields the same selection. If `items.length <=
 * count`, the full set is returned (also shuffled by the seed).
 */
export function dailyPick<T>(items: T[], count: number, seedStr: string): T[] {
  if (items.length === 0) return [];
  const shuffled = shuffleSeeded([...items], seedStr);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function shuffleSeeded<T>(arr: T[], seedStr: string): T[] {
  const rand = makeRng(seedStr);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// FNV-1a hash to fold an arbitrary string into a 32-bit integer seed,
// then a Mulberry32 PRNG to produce a stream of uniform doubles in [0, 1).
function makeRng(seedStr: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's date as YYYY-MM-DD using local time on the rendering machine. */
export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
