"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { updateSpace } from "@/app/(site)/settings/actions";
import InviteMembers from "@/components/settings/invite-members";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelText = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export default function SpaceManagement({
  spaceName,
  anniversaryDate,
}: {
  spaceName: string;
  anniversaryDate: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(spaceName);
  const [anniversary, setAnniversary] = useState(anniversaryDate);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    const res = await updateSpace({ name, anniversaryDate: anniversary });
    if (res.ok) {
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
      setError(res.error);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={save}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Space settings
        </h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className={labelText}>Space name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={status === "saving"}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
          >
            {status === "saving" && <Loader2 className="size-4 animate-spin" />}
            {status === "saved" && <Check className="size-4" />}
            {status === "saving" ? "Saving…" : "Save space"}
          </button>
          {status === "error" && error && (
            <span className="break-words text-sm text-red-600 dark:text-red-400">
              {error}
            </span>
          )}
        </div>
      </form>

      <InviteMembers />
    </div>
  );
}
