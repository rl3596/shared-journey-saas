import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings/settings-tabs";
import { getSpaceContext } from "@/lib/space";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) redirect("/login");

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage your account, appearance, and the active space.
        </p>
      </header>

      <SettingsTabs
        email={ctx.user.email ?? ""}
        spaceName={ctx.space.name}
        anniversaryDate={ctx.space.anniversaryDate ?? ""}
      />
    </section>
  );
}
