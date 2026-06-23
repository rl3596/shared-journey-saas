import Navigation from "@/components/navigation";
import { JourneyAdminProvider } from "@/components/journey-admin-context";
import { getProfile } from "@/lib/profile";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  return (
    <JourneyAdminProvider>
      {/* Sunset backdrop for Home, Gallery, and Schedule. Fixed so it
          parallaxes nicely as you scroll. Sits at -z-10; the Journey page
          paints its own fixed bg image (also -z-10, but later in DOM
          order) which visually covers this gradient on that page. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-violet-300 via-rose-300 to-amber-200 dark:from-violet-900 dark:via-rose-900 dark:to-amber-900"
      />
      <Navigation
        username={profile?.username ?? null}
        avatarUrl={profile?.avatarUrl ?? null}
      />
      <main className="md:ml-64">
        <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
      </main>
    </JourneyAdminProvider>
  );
}
