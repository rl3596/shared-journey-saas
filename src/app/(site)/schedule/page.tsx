import ScheduleBoard from "@/components/schedule-board";
import { getScheduleEvents, getOtherSpaceMembers } from "@/lib/data";
import { getSpaceContext } from "@/lib/space";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const [events, members, ctx] = await Promise.all([
    getScheduleEvents(),
    getOtherSpaceMembers(),
    getSpaceContext(),
  ]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Our plans.</p>
      </header>
      <ScheduleBoard
        initialEvents={events}
        currentUserId={ctx?.user.id ?? ""}
        members={members}
      />
    </section>
  );
}
