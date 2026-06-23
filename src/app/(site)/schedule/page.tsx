import ScheduleBoard from "@/components/schedule-board";
import { getScheduleEvents } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const events = await getScheduleEvents();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Our plans.</p>
      </header>
      <ScheduleBoard initialEvents={events} />
    </section>
  );
}
