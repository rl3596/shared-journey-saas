"use client";

import { useSyncExternalStore } from "react";
import { Heart } from "lucide-react";

// Relationship start date — edit this to your real anniversary.
const START = new Date(2026, 4, 11, 0, 0, 0).getTime(); // May 11, 2026 (local time)
const START_LABEL = "May 11, 2026";

type Elapsed = { days: number; hours: number; minutes: number; seconds: number };

function computeElapsed(now: number): Elapsed {
  const total = Math.floor(Math.max(0, now - START) / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

// A once-per-second clock exposed as an external store. useSyncExternalStore keeps
// it SSR-safe: the server snapshot is null (placeholder), and the live value kicks
// in after the client subscribes — no setState-in-effect, no hydration mismatch.
let currentNow = Date.now();
function subscribe(onStoreChange: () => void) {
  currentNow = Date.now();
  const id = setInterval(() => {
    currentNow = Date.now();
    onStoreChange();
  }, 1000);
  return () => clearInterval(id);
}
const getSnapshot = (): number | null => currentNow;
const getServerSnapshot = (): number | null => null;

export default function AnniversaryCounter() {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const elapsed = now === null ? null : computeElapsed(now);

  const tiles: { label: string; value: number | null }[] = [
    { label: "Days", value: elapsed?.days ?? null },
    { label: "Hours", value: elapsed?.hours ?? null },
    { label: "Minutes", value: elapsed?.minutes ?? null },
    { label: "Seconds", value: elapsed?.seconds ?? null },
  ];

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-rose-400 to-amber-400 px-8 py-6 text-white shadow-lg sm:px-12 sm:py-8 lg:px-14 lg:py-8">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/85 sm:text-sm">
        <Heart className="size-4 sm:size-5" fill="currentColor" />
        Together since {START_LABEL}
      </p>
      <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
        {elapsed
          ? `We've been together for ${elapsed.days.toLocaleString("en-US")} days and ${elapsed.hours} hours`
          : "Counting every moment together…"}
      </h2>
      <div className="mt-5 grid grid-cols-4 gap-3 sm:mt-6 sm:gap-4 lg:gap-6">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl bg-white/15 px-2 py-3 text-center backdrop-blur-sm sm:py-4 lg:py-5"
          >
            <div className="text-3xl font-bold tabular-nums sm:text-5xl lg:text-6xl">
              {t.value === null ? "—" : t.value.toLocaleString("en-US")}
            </div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-white/75 sm:text-xs lg:text-sm">
              {t.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
