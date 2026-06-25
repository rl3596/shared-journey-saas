import { redirect } from "next/navigation";
import FriendsView from "@/components/friends-view";
import { getSpaceContext } from "@/lib/space";
import { getFriendsOverview } from "@/lib/friends";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) redirect("/login");

  const links = await getFriendsOverview();

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Friends</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Connect with people, then invite them to your spaces.
        </p>
      </header>
      <FriendsView links={links} />
    </section>
  );
}
