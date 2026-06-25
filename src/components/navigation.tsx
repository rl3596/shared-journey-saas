"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, Fragment } from "react";
import { Menu, X } from "lucide-react";
import { navRoutes, type NavRoute, type NavSection } from "@/config/navigation";
import SpaceSwitcher from "@/components/space-switcher";
import UserMenu from "@/components/user-menu";
import NotificationBell from "@/components/notification-bell";
import type { AppNotification } from "@/lib/notifications";

type SpaceItem = { id: string; name: string; role: string };

type NavProps = {
  spaces: SpaceItem[];
  activeSpaceId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  notifications: AppNotification[];
};

function NavLink({
  route,
  active,
  onNavigate,
}: {
  route: NavRoute;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = route.icon;
  return (
    <Link
      href={route.path}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      <span>{route.label}</span>
    </Link>
  );
}

/** Renders nav routes grouped by section, with a divider between sections. */
function NavList({
  isActive,
  onNavigate,
}: {
  isActive: (path: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {navRoutes.map((route, i) => {
        const prevSection: NavSection | null =
          i > 0 ? navRoutes[i - 1].section : null;
        const showDivider = prevSection !== null && route.section !== prevSection;
        return (
          <Fragment key={route.path}>
            {showDivider && (
              <div className="my-1.5 border-t border-zinc-200 dark:border-zinc-800" />
            )}
            <NavLink
              route={route}
              active={isActive(route.path)}
              onNavigate={onNavigate}
            />
          </Fragment>
        );
      })}
    </>
  );
}

export default function Navigation({
  spaces,
  activeSpaceId,
  displayName,
  handle,
  avatarUrl,
  notifications,
}: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200 bg-white px-3 py-4 md:flex dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <SpaceSwitcher spaces={spaces} activeSpaceId={activeSpaceId} />
          </div>
          <NotificationBell notifications={notifications} />
        </div>
        <nav className="mt-6 flex flex-col gap-1 px-1">
          <NavList isActive={isActive} />
        </nav>
        <div className="mt-auto border-t border-zinc-200 pt-2 dark:border-zinc-800">
          <UserMenu
            displayName={displayName}
            handle={handle}
            avatarUrl={avatarUrl}
          />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <SpaceSwitcher spaces={spaces} activeSpaceId={activeSpaceId} />
          </div>
          <NotificationBell notifications={notifications} />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            className="shrink-0 rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 px-3 pb-3">
            <NavList isActive={isActive} onNavigate={() => setOpen(false)} />
            <div className="mt-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <UserMenu
                displayName={displayName}
                handle={handle}
                avatarUrl={avatarUrl}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
