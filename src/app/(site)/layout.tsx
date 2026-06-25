import { redirect } from "next/navigation";
import Navigation from "@/components/navigation";
import { JourneyAdminProvider } from "@/components/journey-admin-context";
import { getProfile, displayName } from "@/lib/profile";
import { getSpaceContext, getUserSpaces } from "@/lib/space";
import { getNotifications } from "@/lib/notifications";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, ctx, spaces, notifications] = await Promise.all([
    getProfile(),
    getSpaceContext(),
    getUserSpaces(),
    getNotifications(),
  ]);

  // No session / no space → bounce to login (proxy normally handles this, but
  // this guards the case where memberships can't be read).
  if (!ctx) redirect("/login");

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
        spaces={spaces}
        activeSpaceId={ctx.spaceId}
        displayName={displayName(profile)}
        handle={profile?.handle ?? null}
        avatarUrl={profile?.avatarUrl ?? null}
        notifications={notifications}
      />
      <main className="md:ml-64">
        <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
      </main>
    </JourneyAdminProvider>
  );
}
