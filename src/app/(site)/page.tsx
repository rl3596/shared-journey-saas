import Link from "next/link";
import { CalendarHeart, ArrowRight } from "lucide-react";
import AnniversaryCounter from "@/components/anniversary-counter";
import HomeCover from "@/components/home-cover";
import DailySlideshow from "@/components/daily-slideshow";
import SpecialDesign from "@/components/special-design";
import { getScheduleEvents, getAllPhotos } from "@/lib/data";
import { getSpaceContext } from "@/lib/space";
import { dailyPick, todayKey } from "@/lib/daily-pick";

const DAILY_COUNT = 20;

// Render per request so "Next Up" is evaluated against the current time
// (otherwise a production build would freeze it to build time).
export const dynamic = "force-dynamic";

function formatEventDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatEventTime(t: string): string {
  if (!t) return "";
  const [h, min] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, min || 0).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const event = new Date(y, m - 1, d);
  event.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((event.getTime() - today.getTime()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

export default async function HomePage() {
  const [schedule, allPhotos, ctx] = await Promise.all([
    getScheduleEvents(),
    getAllPhotos(),
    getSpaceContext(),
  ]);
  const anniversaryDate = ctx?.space.anniversaryDate ?? null;

  // eslint-disable-next-line react-hooks/purity -- Server Component rendered per request; reading the current time here is intentional.
  const now = Date.now();
  const nextUp =
    schedule
      .filter((e) => e.owner === "Joint")
      .map((e) => ({
        event: e,
        ts: new Date(`${e.date}T${e.time || "00:00"}`).getTime(),
      }))
      .filter((x) => x.ts >= now)
      .sort((a, b) => a.ts - b.ts)[0]?.event ?? null;

  // Daily Slideshow set — same selection for every viewer for the entire
  // 24-hour calendar day (seed is today's local date).
  const dailyPhotos = dailyPick(allPhotos, DAILY_COUNT, todayKey());

  return (
    <>
      <HomeCover />
      <div className="space-y-6 lg:flex lg:h-[calc(100dvh-5rem)] lg:flex-col lg:gap-5 lg:space-y-0">
        <header>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Home
          </h1>
          <SpecialDesign />
        </header>

        <AnniversaryCounter anniversaryDate={anniversaryDate} />

        <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
          {/* Next Up */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7 lg:flex lg:flex-col lg:p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-500 dark:text-rose-400">
              <CalendarHeart className="size-4" />
              Next Up
            </div>

            {nextUp ? (
              <div className="mt-4">
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                  {relativeDay(nextUp.date)}
                </span>
                <h3 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {nextUp.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {formatEventDate(nextUp.date)} &middot;{" "}
                  {formatEventTime(nextUp.time)}
                </p>
                {nextUp.notes && (
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {nextUp.notes}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                No upcoming plans for the two of you yet.
              </p>
            )}

            <Link
              href="/schedule"
              className="mt-5 inline-flex items-center gap-1 self-start text-sm font-medium text-rose-500 transition-colors hover:text-rose-600 lg:mt-auto lg:pt-5 dark:text-rose-400"
            >
              View schedule
              <ArrowRight className="size-4" />
            </Link>
          </section>

          {/* Daily Slideshow — deterministically picks 20 photos for today
              and rotates through them every 30 s. Click → full-screen
              lightbox cycling the same 20. */}
          <div className="flex flex-col gap-2 lg:min-h-0">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-1 self-end text-sm font-medium text-rose-500 transition-colors hover:text-rose-600 dark:text-rose-400"
            >
              See all our memories
              <ArrowRight className="size-4" />
            </Link>
            <div className="aspect-[4/3] lg:aspect-auto lg:min-h-0 lg:flex-1">
              <DailySlideshow photos={dailyPhotos} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
