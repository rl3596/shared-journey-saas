import { redirect } from "next/navigation";
import ProfileForm from "@/components/profile-form";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

/**
 * A valid, handle-shaped suggestion derived from the user's name/username, with
 * a few stable digits (from their id) to dodge the most common collisions.
 * Shown only as a gray placeholder — it isn't their handle until they save it.
 */
function suggestHandle(seed: string, idSalt: string): string {
  let base = seed
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (base.length < 2) base = "friend";
  base = base.slice(0, 20);
  let h = 0;
  for (const ch of idSalt) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${base}_${String(h % 10000).padStart(4, "0")}`;
}

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const suggestedHandle = suggestHandle(
    profile.username || profile.firstName || "friend",
    profile.id,
  );

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Your public-facing identity across spaces.
        </p>
      </header>

      <ProfileForm
        suggestedHandle={suggestedHandle}
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
