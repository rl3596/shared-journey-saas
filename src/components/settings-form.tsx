"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { updateProfile, updateSpace } from "@/app/(site)/settings/actions";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-rose-500 dark:focus:ring-rose-900/50";
const labelText =
  "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";
const cardClass =
  "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

type Status = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

export default function SettingsForm({
  initialUsername,
  initialAvatarUrl,
  initialSpaceName,
  initialAnniversaryDate,
}: {
  initialUsername: string;
  initialAvatarUrl: string;
  initialSpaceName: string;
  initialAnniversaryDate: string;
}) {
  const router = useRouter();

  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [profileStatus, setProfileStatus] = useState<Status>({ kind: "idle" });

  const [spaceName, setSpaceName] = useState(initialSpaceName);
  const [anniversary, setAnniversary] = useState(initialAnniversaryDate);
  const [spaceStatus, setSpaceStatus] = useState<Status>({ kind: "idle" });

  const onProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus({ kind: "saving" });
    const res = await updateProfile({ username, avatarUrl });
    if (res.ok) {
      setProfileStatus({ kind: "saved" });
      router.refresh();
      setTimeout(() => setProfileStatus({ kind: "idle" }), 2000);
    } else {
      setProfileStatus({ kind: "error", message: res.error });
    }
  };

  const onSpaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpaceStatus({ kind: "saving" });
    const res = await updateSpace({ name: spaceName, anniversaryDate: anniversary });
    if (res.ok) {
      setSpaceStatus({ kind: "saved" });
      router.refresh();
      setTimeout(() => setSpaceStatus({ kind: "idle" }), 2000);
    } else {
      setSpaceStatus({ kind: "error", message: res.error });
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile */}
      <form onSubmit={onProfileSubmit} className={cardClass}>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Profile
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          How you appear in your space.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className={labelText}>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelText}>
              Avatar URL{" "}
              <span className="font-normal text-zinc-400">(optional)</span>
            </span>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
          </label>
        </div>
        <SaveRow status={profileStatus} label="Save profile" />
      </form>

      {/* Space */}
      <form onSubmit={onSpaceSubmit} className={cardClass}>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Space
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Settings shared by everyone in this space.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className={labelText}>Space name</span>
            <input
              type="text"
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              placeholder="e.g. Rui & Wanyun"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelText}>
              Anniversary date{" "}
              <span className="font-normal text-zinc-400">(optional)</span>
            </span>
            <input
              type="date"
              value={anniversary}
              onChange={(e) => setAnniversary(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <SaveRow status={spaceStatus} label="Save space" />
      </form>
    </div>
  );
}

function SaveRow({ status, label }: { status: Status; label: string }) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <button
        type="submit"
        disabled={status.kind === "saving"}
        className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
      >
        {status.kind === "saving" && <Loader2 className="size-4 animate-spin" />}
        {status.kind === "saved" && <Check className="size-4" />}
        {status.kind === "saving" ? "Saving…" : label}
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
  );
}
