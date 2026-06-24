"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { prepareImageForUpload } from "@/lib/heic-convert";
import { uploadAvatar } from "@/app/(site)/profile/actions";

function initials(name: string): string {
  return (name.trim()[0] ?? "·").toUpperCase();
}

/**
 * Avatar with a "Change avatar" button that opens the device's photo picker
 * (on a phone this lets you pick from your camera roll). The chosen image is
 * HEIC-converted + downscaled in the browser, uploaded to Storage, and saved
 * to your profile immediately.
 */
export default function AvatarUpload({
  value,
  fallbackName,
  onChange,
}: {
  value: string;
  fallbackName: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const ready = await prepareImageForUpload(file);
      const fd = new FormData();
      fd.append("file", ready);
      const res = await uploadAvatar(fd);
      if (res.ok) onChange(res.url);
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-4">
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-xl font-semibold text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar from Supabase Storage / arbitrary URL
          <img
            src={value}
            alt=""
            className="size-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          initials(fallbackName)
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="size-5 animate-spin text-white" />
          </span>
        )}
      </span>

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Camera className="size-4" />
          {busy ? "Uploading…" : "Change avatar"}
        </button>
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-2 text-sm text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
          >
            Remove
          </button>
        )}
        {error && (
          <p className="mt-1 break-words text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
