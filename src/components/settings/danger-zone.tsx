"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { deleteAccount } from "@/app/(site)/settings/actions";
import { createClient } from "@/lib/supabase/client";

export default function DangerZone() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    const res = await deleteAccount();
    if (res.ok) {
      // Sign out locally and leave.
      try {
        await createClient().auth.signOut();
      } catch {
        /* ignore */
      }
      router.replace("/login");
      router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/50 dark:bg-zinc-900">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-red-600 dark:text-red-400">
        <AlertTriangle className="size-5" />
        Delete account
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Permanently delete your account. Spaces where you&apos;re the only member
        (and their content) are deleted too. This cannot be undone.
      </p>

      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          Delete my account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
              Type <span className="font-semibold">DELETE</span> to confirm.
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          {error && (
            <p className="break-words text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmText("");
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy || confirmText !== "DELETE"}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Permanently delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
