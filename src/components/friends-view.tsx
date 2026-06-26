"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  UserPlus,
  Check,
  X,
  Clock,
  Users,
  MapPin,
  AtSign,
} from "lucide-react";
import type { FriendLink } from "@/lib/friends";
import {
  searchUser,
  sendFriendRequest,
  respondFriendRequest,
  type FoundUser,
} from "@/lib/actions/friends";

function Avatar({
  url,
  fallback,
  size = "size-10",
}: {
  url: string | null;
  fallback: string;
  size?: string;
}) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-sm font-semibold text-rose-600 dark:bg-rose-950/50 dark:text-rose-300`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary avatar URL
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        fallback.toUpperCase()
      )}
    </span>
  );
}

export default function FriendsView({ links }: { links: FriendLink[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Directory lookup (exact @handle / email) state.
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [found, setFound] = useState<FoundUser | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Add-friend modal.
  const [addTarget, setAddTarget] = useState<FoundUser | null>(null);
  const [message, setMessage] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Respond-to-incoming busy id.
  const [respondId, setRespondId] = useState<string | null>(null);

  // Mini-profile popover for a clicked friend.
  const [profileTarget, setProfileTarget] = useState<FriendLink | null>(null);

  const accepted = useMemo(
    () =>
      links
        .filter((l) => l.status === "accepted")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [links],
  );
  const incoming = useMemo(
    () => links.filter((l) => l.status === "pending" && l.direction === "incoming"),
    [links],
  );
  const outgoing = useMemo(
    () => links.filter((l) => l.status === "pending" && l.direction === "outgoing"),
    [links],
  );
  const linkByOther = useMemo(() => {
    const m = new Map<string, FriendLink>();
    for (const l of links) m.set(l.otherId, l);
    return m;
  }, [links]);

  const q = query.trim().toLowerCase();
  const filteredFriends = q
    ? accepted.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.handle ?? "").toLowerCase().includes(q),
      )
    : accepted;

  const runLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLookupBusy(true);
    setLookupDone(false);
    setFound(null);
    setLookupError(null);
    const res = await searchUser(query);
    if (res.ok) setFound(res.results?.[0] ?? null);
    else setLookupError(res.error ?? "Search failed.");
    setLookupBusy(false);
    setLookupDone(true);
  };

  const submitAdd = async () => {
    if (!addTarget) return;
    setActionBusy(true);
    setActionError(null);
    const res = await sendFriendRequest(addTarget.id, message);
    if (res.ok) {
      setAddTarget(null);
      setMessage("");
      setQuery("");
      setLookupDone(false);
      setFound(null);
      router.refresh();
    } else {
      setActionError(res.error);
    }
    setActionBusy(false);
  };

  const respond = async (friendshipId: string, accept: boolean) => {
    setRespondId(friendshipId);
    await respondFriendRequest(friendshipId, accept);
    router.refresh();
    setRespondId(null);
  };

  // What to render for the directory result row.
  const foundRelation = found ? linkByOther.get(found.id) : undefined;

  return (
    <div className="space-y-6">
      {/* Search */}
      <form onSubmit={runLookup} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends, or find by @handle / email"
            className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={lookupBusy || !query.trim()}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {lookupBusy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Find
        </button>
      </form>

      {/* Directory lookup result */}
      {lookupError && (
        <p className="break-words text-sm text-red-600 dark:text-red-400">{lookupError}</p>
      )}
      {lookupDone && !lookupError && !found && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No user found with that exact @handle or email.
        </p>
      )}
      {found && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <Avatar url={found.avatarUrl} fallback={found.name?.[0] ?? found.handle?.[0] ?? "·"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {found.name ?? "User"}
            </p>
            {found.handle && (
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{found.handle}</p>
            )}
          </div>
          {foundRelation?.status === "accepted" ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Check className="size-4" /> Friends
            </span>
          ) : foundRelation?.status === "pending" ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <Clock className="size-4" />
              {foundRelation.direction === "outgoing" ? "Requested" : "Respond below"}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAddTarget(found);
                setMessage("");
                setActionError(null);
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600"
            >
              <UserPlus className="size-4" /> Add Friend
            </button>
          )}
        </div>
      )}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Friend requests
          </h2>
          <ul className="space-y-2">
            {incoming.map((l) => (
              <li
                key={l.friendshipId}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Avatar url={l.avatarUrl} fallback={l.name[0] ?? "·"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{l.name}</p>
                  {l.handle && (
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{l.handle}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={respondId === l.friendshipId}
                  onClick={() => respond(l.friendshipId, true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
                >
                  {respondId === l.friendshipId ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Accept
                </button>
                <button
                  type="button"
                  disabled={respondId === l.friendshipId}
                  onClick={() => respond(l.friendshipId, false)}
                  aria-label="Decline"
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-300 p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Accepted friends */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Your friends{accepted.length > 0 && ` · ${accepted.length}`}
        </h2>
        {accepted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <Users className="mx-auto size-6 text-zinc-400" />
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              No friends yet. Find someone by their @handle or email above.
            </p>
          </div>
        ) : filteredFriends.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No friends match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredFriends.map((f) => (
              <li
                key={f.friendshipId}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <button
                  type="button"
                  onClick={() => setProfileTarget(f)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-opacity hover:opacity-70"
                  aria-label={`View ${f.name}'s profile`}
                >
                  <Avatar url={f.avatarUrl} fallback={f.name[0] ?? "·"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{f.name}</p>
                    {f.handle && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{f.handle}</p>
                    )}
                  </div>
                </button>
                {/* Reserved for a future "Message" button (Friend DMs). */}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Outgoing pending */}
      {outgoing.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Pending
          </h2>
          <ul className="space-y-2">
            {outgoing.map((l) => (
              <li
                key={l.friendshipId}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Avatar url={l.avatarUrl} fallback={l.name[0] ?? "·"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{l.name}</p>
                  {l.handle && (
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{l.handle}</p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <Clock className="size-3.5" /> Requested
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Friend mini-profile */}
      {profileTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setProfileTarget(null)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={() => setProfileTarget(null)}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <X className="size-5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <Avatar
                url={profileTarget.avatarUrl}
                fallback={profileTarget.name[0] ?? "·"}
                size="size-20"
              />
              <h2 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {profileTarget.name}
              </h2>
              {profileTarget.handle && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                  <AtSign className="size-3.5" />
                  {profileTarget.handle}
                </p>
              )}
              {profileTarget.location && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                  <MapPin className="size-4 text-rose-500" />
                  {profileTarget.location}
                </p>
              )}
            </div>
            {profileTarget.bio ? (
              <p className="mt-4 whitespace-pre-wrap border-t border-zinc-100 pt-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                {profileTarget.bio}
              </p>
            ) : (
              !profileTarget.location && (
                <p className="mt-4 border-t border-zinc-100 pt-4 text-center text-sm text-zinc-400 dark:border-zinc-800">
                  No details shared yet.
                </p>
              )
            )}
          </div>
        </div>
      )}

      {/* Add-friend modal */}
      {addTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !actionBusy && setAddTarget(null)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <div className="flex items-center gap-3">
              <Avatar url={addTarget.avatarUrl} fallback={addTarget.name?.[0] ?? "·"} />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Add {addTarget.name ?? "friend"}
                </h2>
                {addTarget.handle && (
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">@{addTarget.handle}</p>
                )}
              </div>
            </div>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Add a message <span className="font-normal text-zinc-400">(optional)</span>
              </span>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hey! Let's connect on Remember."
                className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            {actionError && (
              <p className="mt-2 break-words text-sm text-red-600 dark:text-red-400">{actionError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !actionBusy && setAddTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAdd}
                disabled={actionBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
              >
                {actionBusy && <Loader2 className="size-4 animate-spin" />}
                Send request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
