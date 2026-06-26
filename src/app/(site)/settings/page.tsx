import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings/settings-tabs";
import { getSpaceContext, getUserSpaces, getSpaceMembers } from "@/lib/space";
import { getAcceptedFriends } from "@/lib/friends";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [ctx, spaces, friends] = await Promise.all([
    getSpaceContext(),
    getUserSpaces(),
    getAcceptedFriends(),
  ]);
  if (!ctx) redirect("/login");

  // Members for every space the user belongs to (few spaces; cheap to fetch).
  const spaceCards = await Promise.all(
    spaces.map(async (s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      anniversaryDate: s.anniversaryDate ?? "",
      backgroundUrl: s.backgroundUrl ?? "",
      members: await getSpaceMembers(s.id),
    })),
  );

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage your account, appearance, and your spaces.
        </p>
      </header>

      <SettingsTabs
        email={ctx.user.email ?? ""}
        currentUserId={ctx.user.id}
        activeSpaceId={ctx.spaceId}
        spaces={spaceCards}
        friends={friends}
      />
    </section>
  );
}
