"use client";

import { useState } from "react";
import { Search, Loader2, UserPlus, Check } from "lucide-react";
import { searchUser, sendInvite, type FoundUser } from "@/lib/actions/invite";

export default function InviteMembers() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoundUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setResults(null);
    const res = await searchUser(query);
    if (res.ok) setResults(res.results ?? []);
    else setError(res.error ?? "Search failed.");
    setSearching(false);
  };

  const invite = async (u: FoundUser) => {
    setInvitingId(u.id);
    setError(null);
    const res = await sendInvite(u.id);
    if (res.ok) setInvited((prev) => new Set(prev).add(u.id));
    else setError(res.error);
    setInvitingId(null);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Invite members
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Find someone by their exact <span className="font-medium">@handle</span>{" "}
        or email, then send them an invite to this space.
      </p>

      <form onSubmit={doSearch} className="mt-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="@handle or email"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Search
        </button>
      </form>

      {error && (
        <p className="mt-3 break-words text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {results && results.length === 0 && !error && (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          No user found with that exact handle or email.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((u) => {
            const done = invited.has(u.id);
            return (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-sm font-semibold text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                  {u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary avatar URL
                    <img src={u.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    (u.name?.[0] ?? u.handle?.[0] ?? "·").toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {u.name ?? "User"}
                  </span>
                  {u.handle && (
                    <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      @{u.handle}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => invite(u)}
                  disabled={done || invitingId === u.id}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    done
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-60"
                  }`}
                >
                  {invitingId === u.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : done ? (
                    <Check className="size-4" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  {done ? "Invited" : "Send invite"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
