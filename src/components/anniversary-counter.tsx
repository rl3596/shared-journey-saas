"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";

type Elapsed = { days: number; hours: number; minutes: number; seconds: number };

function computeElapsed(now: number, start: number): Elapsed {
  const total = Math.floor(Math.max(0, now - start) / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

// A once-per-second clock exposed as an external store. useSyncExternalStore
// keeps it SSR-safe: the server snapshot is null (placeholder), the live value
// kicks in after the client subscribes — no setState-in-effect, no hydration
// mismatch.
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

function formatAnniversary(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Live "together since" counter. The anniversary date now comes from the
 * active space (passed as an ISO YYYY-MM-DD string). When it isn't set yet,
 * the card invites the user to add it in Settings.
 */
export default function AnniversaryCounter({
  anniversaryDate,
}: {
  anniversaryDate: string | null;
}) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const startMs = anniversaryDate
    ? (() => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anniversaryDate);
        return m
          ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
          : null;
      })()
    : null;

  const elapsed =
    now === null || startMs === null ? null : computeElapsed(now, startMs);

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
        {anniversaryDate
          ? `Together since ${formatAnniversary(anniversaryDate)}`
          : "Your shared journey"}
      </p>

      {anniversaryDate ? (
        <>
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
        </>
      ) : (
        <>
          <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
            Set your anniversary date to start the countdown.
          </h2>
          <Link
            href="/settings"
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            Add it in Settings →
          </Link>
        </>
      )}
    </section>
  );
}
