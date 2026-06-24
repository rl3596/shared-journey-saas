"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { updateProfile } from "@/app/(site)/profile/actions";
import AvatarUpload from "@/components/avatar-upload";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-rose-500 dark:focus:ring-rose-900/50";
const labelText =
  "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

type Status = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

export default function ProfileForm({
  initial,
}: {
  initial: {
    username: string;
    handle: string;
    firstName: string;
    lastName: string;
    location: string;
    bio: string;
    avatarUrl: string;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleValid =
    form.handle.trim() === "" || HANDLE_RE.test(form.handle.trim().toLowerCase());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handleValid) {
      setStatus({
        kind: "error",
        message:
          "Handle must be 3–30 chars: lowercase letters, numbers, underscores.",
      });
      return;
    }
    setStatus({ kind: "saving" });
    const res = await updateProfile(form);
    if (res.ok) {
      setStatus({ kind: "saved" });
      router.refresh();
      setTimeout(() => setStatus({ kind: "idle" }), 2000);
    } else {
      setStatus({ kind: "error", message: res.error });
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Avatar — pick from your phone's photos */}
      <AvatarUpload
        value={form.avatarUrl}
        fallbackName={form.firstName || form.username || "·"}
        onChange={(url) => {
          set("avatarUrl", url);
          router.refresh(); // update the sidebar card immediately
        }}
      />

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className={labelText}>Display name</span>
          <input
            type="text"
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            placeholder="How you're shown"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelText}>Handle</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">@</span>
            <input
              type="text"
              value={form.handle}
              onChange={(e) =>
                set("handle", e.target.value.toLowerCase().replace(/\s/g, ""))
              }
              placeholder="rui_9921"
              className={inputClass}
            />
          </div>
          {!handleValid && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              3–30 characters: lowercase letters, numbers, underscores.
            </p>
          )}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelText}>First name</span>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelText}>Last name</span>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelText}>Location</span>
          <input
            type="text"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="City, Country"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelText}>Bio</span>
          <textarea
            rows={3}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="A little about you…"
            className={`${inputClass} resize-none`}
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={status.kind === "saving"}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
        >
          {status.kind === "saving" && <Loader2 className="size-4 animate-spin" />}
          {status.kind === "saved" && <Check className="size-4" />}
          {status.kind === "saving" ? "Saving…" : "Save profile"}
        </button>
        {status.kind === "saved" && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Saved
          </span>
        )}
        {status.kind === "error" && (
          <span className="break-words text-sm text-red-600 dark:text-red-400">
            {status.message}
          </span>
        )}
      </div>
    </form>
  );
}
