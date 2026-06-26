"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";

type Elapsed = {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
};

/**
 * Add `n` whole months to a date, clamping the day to the target month's last
 * day (so Jan 31 + 1mo = Feb 28, not Mar 3). Keeps the time-of-day.
 */
function addMonths(base: Date, n: number): Date {
  const total = base.getMonth() + n;
  const year = base.getFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(base.getDate(), lastDay);
  return new Date(year, month, day, base.getHours(), base.getMinutes());
}

/**
 * Calendar-aware elapsed time since `startMs`. Months/years count by the
 * calendar, not by 30/365-day blocks: from Feb 10, Mar 10 is exactly 1 month
 * (28 days); from May 10, Jun 10 is also 1 month (31 days). The leftover days/
 * hours/minutes are measured from the most recent month-iversary.
 */
function computeElapsed(nowMs: number, startMs: number): Elapsed {
  const start = new Date(startMs);
  const now = new Date(Math.max(nowMs, startMs));

  let totalMonths =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  // Haven't reached the day-of-month yet this month → back off one.
  if (addMonths(start, totalMonths).getTime() > now.getTime()) totalMonths -= 1;
  if (totalMonths < 0) totalMonths = 0;

  // Remaining days/hours/minutes since the most recent month-iversary, via
  // wall-clock components with borrowing (no millisecond math, so daylight-
  // saving shifts can't knock the day count an hour off).
  const anchor = addMonths(start, totalMonths);
  let days = now.getDate() - anchor.getDate();
  let hours = now.getHours() - anchor.getHours();
  let minutes = now.getMinutes() - anchor.getMinutes();
  if (minutes < 0) {
    minutes += 60;
    hours -= 1;
  }
  if (hours < 0) {
    hours += 24;
    days -= 1;
  }
  if (days < 0) {
    // Borrow the length of anchor's month (now is at most one month later).
    days += new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  }

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days,
    hours,
    minutes,
  };
}

// A clock exposed as an external store. useSyncExternalStore keeps it SSR-safe:
// the server snapshot is null (placeholder), the live value kicks in after the
// client subscribes — no setState-in-effect, no hydration mismatch.
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

function plural(n: number, unit: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? unit : `${unit}s`}`;
}

/** A natural-language summary built from the meaningful units. */
function summarize(e: Elapsed): string {
  const parts: string[] = [];
  if (e.years >= 1) parts.push(plural(e.years, "year"));
  if (e.years >= 1 || e.months >= 1) parts.push(plural(e.months, "month"));
  parts.push(plural(e.days, "day"));
  // Below a month, hours add a nice "live" touch to the headline.
  if (e.years < 1 && e.months < 1) parts.push(plural(e.hours, "hour"));
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Live "together since" counter. The anniversary date comes from the active
 * space (an ISO YYYY-MM-DD string). When it isn't set yet, the card invites
 * the user to add it in Settings.
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

  // Tiles grow with the elapsed span: Days/Hours/Minutes, then Months once a
  // month has passed, then Years once a year has passed.
  const tiles: { label: string; value: number | null }[] = elapsed
    ? [
        ...(elapsed.years >= 1
          ? [{ label: "Years", value: elapsed.years }]
          : []),
        ...(elapsed.years >= 1 || elapsed.months >= 1
          ? [{ label: "Months", value: elapsed.months }]
          : []),
        { label: "Days", value: elapsed.days },
        { label: "Hours", value: elapsed.hours },
        { label: "Minutes", value: elapsed.minutes },
      ]
    : [
        { label: "Days", value: null },
        { label: "Hours", value: null },
        { label: "Minutes", value: null },
      ];

  const gridClass =
    tiles.length >= 5
      ? "grid-cols-5"
      : tiles.length === 4
        ? "grid-cols-4"
        : "grid-cols-3";

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
              ? `We've been together for ${summarize(elapsed)}`
              : "Counting every moment together…"}
          </h2>
          <div
            className={`mt-5 grid ${gridClass} gap-2 sm:mt-6 sm:gap-3 lg:gap-5`}
          >
            {tiles.map((t) => (
              <div
                key={t.label}
                className="rounded-2xl bg-white/15 px-1.5 py-3 text-center backdrop-blur-sm sm:px-2 sm:py-4 lg:py-5"
              >
                <div className="text-2xl font-bold tabular-nums sm:text-4xl lg:text-5xl">
                  {t.value === null ? "—" : t.value.toLocaleString("en-US")}
                </div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/75 sm:text-xs lg:text-sm">
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
