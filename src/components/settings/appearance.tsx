"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

// false during SSR/hydration, true once mounted — without setState-in-effect.
const emptySubscribe = () => () => {};

const THEMES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

const cardClass =
  "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

export default function Appearance() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Theme</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose how the app looks on this device.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {THEMES.map(({ value, label, Icon }) => {
            const active = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-4 text-sm font-medium transition-colors ${
                  active
                    ? "border-rose-400 bg-rose-50 text-rose-600 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-300"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <Icon className="size-5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Background
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Each space now has its own background picture, set by the space owner
          in{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Space Management
          </span>
          . It&apos;s shared by everyone in the space.
        </p>
      </div>
    </div>
  );
}
