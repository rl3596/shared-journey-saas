import { redirect } from "next/navigation";
import Navigation from "@/components/navigation";
import NotificationsRealtime from "@/components/notifications-realtime";
import SpaceNotesBoard from "@/components/space-notes-board";
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
      {/* Default sunset backdrop — shown when the active space has no custom
          background. Fixed so it parallaxes as you scroll. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-violet-300 via-rose-300 to-amber-200 dark:from-violet-900 dark:via-rose-900 dark:to-amber-900"
      />
      {/* Per-space background picture (shared by everyone in the space). Sits
          above the gradient; a readability scrim keeps content legible. */}
      {ctx.space.backgroundUrl && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${ctx.space.backgroundUrl}')` }}
          />
          <div className="absolute inset-0 bg-white/55 dark:bg-zinc-950/60" />
        </div>
      )}
      <Navigation
        spaces={spaces}
        activeSpaceId={ctx.spaceId}
        displayName={displayName(profile)}
        handle={profile?.handle ?? null}
        avatarUrl={profile?.avatarUrl ?? null}
        notifications={notifications}
      />
      <NotificationsRealtime currentUserId={ctx.user.id} />
      <SpaceNotesBoard
        spaceId={ctx.spaceId}
        currentUserId={ctx.user.id}
        currentUserName={displayName(profile)}
        currentUserAvatar={profile?.avatarUrl ?? null}
      />
      <main className="md:ml-64">
        <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
      </main>
    </JourneyAdminProvider>
  );
}
