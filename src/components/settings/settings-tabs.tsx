"use client";

import { useState } from "react";
import { ShieldCheck, Palette, Users, TriangleAlert } from "lucide-react";
import AccountSecurity from "@/components/settings/account-security";
import Appearance from "@/components/settings/appearance";
import SpaceManagement from "@/components/settings/space-management";
import DangerZone from "@/components/settings/danger-zone";

type TabKey = "account" | "appearance" | "space" | "danger";

const TABS: { key: TabKey; label: string; Icon: typeof Users }[] = [
  { key: "account", label: "Account Security", Icon: ShieldCheck },
  { key: "appearance", label: "Appearance", Icon: Palette },
  { key: "space", label: "Space Management", Icon: Users },
  { key: "danger", label: "Danger Zone", Icon: TriangleAlert },
];

export default function SettingsTabs({
  email,
  spaceName,
  anniversaryDate,
}: {
  email: string;
  spaceName: string;
  anniversaryDate: string;
}) {
  const [tab, setTab] = useState<TabKey>("account");

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Tab nav */}
      <nav className="flex gap-1 overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Active panel */}
      <div className="min-w-0 flex-1">
        {tab === "account" && <AccountSecurity email={email} />}
        {tab === "appearance" && <Appearance />}
        {tab === "space" && (
          <SpaceManagement spaceName={spaceName} anniversaryDate={anniversaryDate} />
        )}
        {tab === "danger" && <DangerZone />}
      </div>
    </div>
  );
}
