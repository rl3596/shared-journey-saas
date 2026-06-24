import { redirect } from "next/navigation";
import ProfileForm from "@/components/profile-form";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Your public-facing identity across spaces.
        </p>
      </header>

      <ProfileForm
        initial={{
          username: profile.username ?? "",
          handle: profile.handle ?? "",
          firstName: profile.firstName ?? "",
          lastName: profile.lastName ?? "",
          location: profile.location ?? "",
          bio: profile.bio ?? "",
          avatarUrl: profile.avatarUrl ?? "",
        }}
      />
    </section>
  );
}
