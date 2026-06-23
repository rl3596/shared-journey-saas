"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Heart, Menu, X, LogOut } from "lucide-react";
import { navRoutes, type NavRoute } from "@/config/navigation";
import { useJourneyAdmin } from "@/components/journey-admin-context";

function Brand() {
  const { isJourneyAdmin, toggleJourneyAdmin, showToast } = useJourneyAdmin();
  // Secret trigger: 5 clicks within 3 seconds toggles Journey Admin Mode.
  const clicksRef = useRef<number[]>([]);

  const handleClick = () => {
    const now = Date.now();
    clicksRef.current = clicksRef.current.filter((t) => now - t < 3000);
    clicksRef.current.push(now);
    if (clicksRef.current.length >= 5) {
      clicksRef.current = [];
      const willBeAdmin = !isJourneyAdmin;
      toggleJourneyAdmin();
      showToast(
        `Journey Admin Mode: ${willBeAdmin ? "Activated" : "Deactivated"}`,
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Us"
      className="flex cursor-pointer items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
    >
      <Heart className="size-5 text-rose-500" fill="currentColor" />
      <span>Us</span>
    </button>
  );
}

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

const logoutButtonClass =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // ignore network errors; redirect regardless
    }
    setOpen(false);
    router.replace("/login");
    router.refresh();
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200 bg-white px-4 py-6 md:flex dark:border-zinc-800 dark:bg-zinc-950">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {navRoutes.map((route) => (
            <NavLink
              key={route.path}
              route={route}
              active={isActive(route.path)}
            />
          ))}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className={`mt-auto ${logoutButtonClass}`}
        >
          <LogOut className="size-4 shrink-0" />
          <span>Lock</span>
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 px-4 pb-3">
            {navRoutes.map((route) => (
              <NavLink
                key={route.path}
                route={route}
                active={isActive(route.path)}
                onNavigate={() => setOpen(false)}
              />
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className={logoutButtonClass}
            >
              <LogOut className="size-4 shrink-0" />
              <span>Lock</span>
            </button>
          </nav>
        )}
      </header>
    </>
  );
}
