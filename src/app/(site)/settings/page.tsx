import { redirect } from "next/navigation";
import SettingsForm from "@/components/settings-form";
import { getSpaceContext } from "@/lib/space";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) redirect("/login");
  const profile = await getProfile();

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage your profile and your shared space.
        </p>
      </header>

      <SettingsForm
        initialUsername={profile?.username ?? ""}
        initialAvatarUrl={profile?.avatarUrl ?? ""}
        initialSpaceName={ctx.space.name}
        initialAnniversaryDate={ctx.space.anniversaryDate ?? ""}
      />
    </section>
  );
}
