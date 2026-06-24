"use client";

import { useSyncExternalStore } from "react";

const KEY = "sj_custom_bg";
const EVENT = "sj-custom-bg-change";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const getSnapshot = () => window.localStorage.getItem(KEY) ?? "";
const getServerSnapshot = () => "";

/** Reactive custom-background URL (per-device, localStorage-backed). */
export function useCustomBackground(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Set or clear the custom background; notifies all subscribers. */
export function setCustomBackground(url: string) {
  if (url) window.localStorage.setItem(KEY, url);
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Global blurred backdrop. When a custom background image is set, it renders
 * behind app content but above the per-page sunset gradient. useSyncExternal-
 * Store keeps SSR (no bg) and client in sync without hydration mismatch.
 */
export default function CustomBackground() {
  const url = useCustomBackground();
  if (!url) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: -5 }}>
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl"
        style={{ backgroundImage: `url('${url}')` }}
      />
      <div className="absolute inset-0 bg-white/30 dark:bg-black/50" />
    </div>
  );
}
