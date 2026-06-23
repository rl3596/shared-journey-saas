"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Incorrect password");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setPending(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 to-amber-50 p-6 dark:from-zinc-950 dark:to-zinc-900">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-500 dark:bg-rose-950/50">
            <Heart className="size-6" fill="currentColor" />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Enter our shared password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="block">
            <span className="sr-only">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-rose-900/50"
            />
          </label>
          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Lock className="size-4" />
            {pending ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}
