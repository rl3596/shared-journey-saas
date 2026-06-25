import { redirect } from "next/navigation";
import LoveJourneyTimeline from "@/components/love-journey-timeline";
import JourneyEditToggle from "@/components/journey-edit-toggle";
import { getTimelineEvents } from "@/lib/data";
import { getSpaceContext } from "@/lib/space";
import { getProfile, displayName } from "@/lib/profile";

export const dynamic = "force-dynamic";

const BACKGROUND_URL =
  "https://yyxfjcgqhttcjkfzwbvm.supabase.co/storage/v1/object/public/gallery/backgrounds/Our_Journey_bg.jpeg";

export default async function LoveJourneyPage() {
  const ctx = await getSpaceContext();
  if (!ctx) redirect("/login");
  const [events, profile, ownerRow] = await Promise.all([
    getTimelineEvents(),
    getProfile(),
    ctx.supabase
      .from("space_members")
      .select("user_id")
      .eq("space_id", ctx.spaceId)
      .eq("role", "owner")
      .maybeSingle(),
  ]);
  const ownerId = (ownerRow.data?.user_id as string) ?? null;

  return (
    <>
      {/* Fixed background image — only visible on this page. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${BACKGROUND_URL}')` }}
      />
      {/* Readability overlay so headings and timeline cards stay legible. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-white/60 dark:bg-zinc-950/70"
      />
      <section className="space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Our Journey</h1>
            <p className="text-zinc-700 dark:text-zinc-300">
              The milestones that brought us here — scroll through our story.
            </p>
          </div>
          <JourneyEditToggle />
        </header>
        <LoveJourneyTimeline
          events={events}
          currentUserId={ctx.user.id}
          ownerId={ownerId}
          currentUserName={displayName(profile)}
          isOwner={ctx.user.id === ownerId}
        />
      </section>
    </>
  );
}
