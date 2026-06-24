"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, ImagePlus, Loader2 } from "lucide-react";
import { prepareImageForUpload } from "@/lib/heic-convert";
import { uploadBackground } from "@/app/(site)/settings/actions";
import {
  useCustomBackground,
  setCustomBackground,
} from "@/components/custom-background";

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
  const bg = useCustomBackground();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const ready = await prepareImageForUpload(file);
      const fd = new FormData();
      fd.append("file", ready);
      const res = await uploadBackground(fd);
      if (res.ok) setCustomBackground(res.url);
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeBg = () => setCustomBackground("");

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
          Custom background
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          A photo applied as a soft, blurred backdrop across the app (saved on
          this device).
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div
            className="size-20 shrink-0 rounded-xl bg-zinc-100 bg-cover bg-center ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700"
            style={bg ? { backgroundImage: `url('${bg}')` } : undefined}
          />
          <div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              {busy ? "Uploading…" : "Upload background"}
            </button>
            {bg && !busy && (
              <button
                type="button"
                onClick={removeBg}
                className="ml-2 text-sm text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
              >
                Remove
              </button>
            )}
            {error && (
              <p className="mt-1 break-words text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={handleBg}
        />
      </div>
    </div>
  );
}
