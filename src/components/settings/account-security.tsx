"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelText = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

function Note({ msg, kind }: { msg: string; kind: "ok" | "err" }) {
  return (
    <p
      className={`break-words text-sm ${
        kind === "ok"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {msg}
    </p>
  );
}

export default function AccountSecurity({ email }: { email: string }) {
  const [newEmail, setNewEmail] = useState(email);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNote, setEmailNote] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNote, setPwNote] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailBusy(true);
    setEmailNote(null);
    const { error } = await createClient().auth.updateUser({ email: newEmail.trim() });
    setEmailNote(
      error
        ? { msg: error.message, kind: "err" }
        : { msg: "Check your inboxes — confirm the change from the link we sent.", kind: "ok" },
    );
    setEmailBusy(false);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) {
      setPwNote({ msg: "Password must be at least 6 characters.", kind: "err" });
      return;
    }
    if (pw !== pw2) {
      setPwNote({ msg: "Passwords don't match.", kind: "err" });
      return;
    }
    setPwBusy(true);
    setPwNote(null);
    const { error } = await createClient().auth.updateUser({ password: pw });
    if (error) {
      setPwNote({ msg: error.message, kind: "err" });
    } else {
      setPwNote({ msg: "Password updated.", kind: "ok" });
      setPw("");
      setPw2("");
    }
    setPwBusy(false);
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={changeEmail}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Login email</h2>
        <label className="mt-4 block">
          <span className={labelText}>Email</span>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        {emailNote && <div className="mt-2"><Note {...emailNote} /></div>}
        <button
          type="submit"
          disabled={emailBusy || newEmail.trim() === email}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
        >
          {emailBusy && <Loader2 className="size-4 animate-spin" />}
          Update email
        </button>
      </form>

      <form
        onSubmit={changePassword}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Password</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelText}>New password</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelText}>Confirm password</span>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
        </div>
        {pwNote && <div className="mt-2"><Note {...pwNote} /></div>}
        <button
          type="submit"
          disabled={pwBusy || pw === ""}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
        >
          {pwBusy && <Loader2 className="size-4 animate-spin" />}
          Update password
        </button>
      </form>
    </div>
  );
}
