# Remember

**Remember** is a multi-tenant web app for couples, families, and close
friends to keep a shared journal of their relationship. People sign up
individually, then collaborate inside a **Space** — a private shared unit with
its own journey timeline, photo gallery, schedule, and notes. A person can
belong to several spaces and switch between them.

It started as a single-couple tracker (`couples-site`) and was re-architected
into a multi-tenant SaaS around the **Space** concept.

### What's inside a Space

| Feature | Route | What it does |
| --- | --- | --- |
| **Home** | `/` | A live "together since" counter (calendar months/years) + "Next Up" event + a daily photo slideshow. |
| **Our Journey** | `/love-journey` | A milestone timeline; each member adds their own comment per milestone. |
| **Gallery** | `/gallery` | Photo albums with a grid and a map ("footprints") view. |
| **Schedule** | `/schedule` | Personal & joint events with time zones, a list view, and a month calendar. |
| **Space Notes** | floating board | Realtime per-space sticky notes with a live unread glow. |

### Account-level (across all spaces)

- **Friends** (`/friends`) — connect with people by `@handle`/email; only
  friends can be invited to a space.
- **Notifications** — a realtime bell for friend requests and space invites.
- **Profile** (`/profile`) and **Settings** (`/settings`) — identity,
  appearance/theme, and Space Management.

---

## Tech stack

**Frontend**

- **Next.js 16** (App Router, Turbopack) + **React 19** — note: this is a
  newer Next.js with breaking changes; see `AGENTS.md`. Middleware is
  `src/proxy.ts` (renamed from `middleware.ts`).
- **TypeScript**.
- **Tailwind CSS v4** for styling; **next-themes** for light/dark.
- **framer-motion** (animations), **lucide-react** (icons), **sonner**
  (toasts), **react-leaflet** (gallery map), **heic2any** (HEIC → JPEG on
  upload).

**Backend** — there is no separate backend server; **Supabase** is the backend:

- **Postgres** database with **Row Level Security (RLS)** for all tenant
  isolation.
- **Supabase Auth** (email/password).
- **Supabase Storage** (avatars, backgrounds, gallery photos).
- **Supabase Realtime** (WebSockets) for live notifications and notes.
- Server-side logic runs as **Next.js Server Actions** and a few API routes,
  using the Supabase server client (RLS-scoped) — and the service-role client
  only for narrow privileged tasks.

**Hosting** — **Vercel** (auto-deploys from GitHub). **GitHub** is the source
of truth for code.

---

## How Supabase, GitHub & Vercel fit together

```
  You ──push──▶  GitHub repo  ──webhook──▶  Vercel
                (source code)              (builds Next.js, hosts the app)
                                               │
                                  reads NEXT_PUBLIC_* / service-role
                                  env vars at build & runtime
                                               ▼
                                           Supabase
                              (Postgres + Auth + Storage + Realtime)
```

- **GitHub** holds the code. Every push to `main` triggers a Vercel build.
- **Vercel** builds and serves the Next.js app. It injects the Supabase
  environment variables so the app can reach the database/auth/storage.
- **Supabase** is the database and backend services. Schema changes are
  **applied directly in the Supabase SQL editor** (see Migrations) — they are
  _not_ run by Vercel.

### One-time wiring

1. **Supabase** — create a project. In **SQL Editor**, run `supabase/schema.sql`
   once to create the full schema (tables, RLS, triggers, RPCs, realtime).
   Create the Storage bucket used for uploads. Grab the API keys from
   **Project Settings → API**.
2. **GitHub** — this repo (`rl3596/shared-journey-saas`) is the remote.
3. **Vercel** — "Add New Project" → import the GitHub repo. Vercel
   auto-detects Next.js. Add the environment variables below in
   **Project Settings → Environment Variables**, then deploy. After this,
   pushing to `main` redeploys automatically.

### Environment variables

Copy `.env.example` → `.env.local` for local dev, and set the same in Vercel:

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key (safe; gated by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Bypasses RLS; server-only privileged tasks. Never prefix with `NEXT_PUBLIC`. |

`.env.local` is gitignored and must never be committed.

---

## Database structure

All content belongs to a **Space**; RLS lets a user touch a row only when
their `auth.uid()` is a member of that row's space. Full DDL lives in
`supabase/schema.sql`.

**Tenancy & identity**

- `spaces` — `id`, `name`, `anniversary_date`, `background_url`.
- `profiles` — `id` (→ `auth.users`), `username` (the single display **name**),
  `handle` (unique `@handle`), `pronouns`, `links`, `location`, `bio`,
  `avatar_url`.
- `space_members` — `(space_id, user_id, role)` where role is `owner` | `member`.

**Social**

- `friendships` — `requester_id`, `addressee_id`, `status`
  (`pending`/`accepted`/`rejected`); one row per unordered pair.
- `notifications` — unified inbox: `user_id` (recipient), `sender_id`, `type`
  (`friend_request`/`friend_accepted`/`friend_rejected`/`space_invite`/
  `space_accepted`/`space_rejected`), `reference_id`, `message`, `is_read`.
- `space_invitations` — legacy, superseded by `notifications`.

**Content (all scoped by `space_id`)**

- `timeline_events` + `timeline_comments` (one comment per member per event).
- `albums` — photos as `image_urls[]`, plus `latitude`/`longitude` for the map.
- `schedule_events` — `creator_id`, `participant_ids[]` (non-empty = joint),
  `timezone`.
- `space_notes` — `author_id`, `content`, `color`.

**Security model**

- `SECURITY DEFINER` helper functions avoid RLS recursion:
  `is_space_member()`, `is_space_owner()`, `shares_space_with()`.
- Enriched cross-RLS reads use DEFINER RPCs: `search_profile`,
  `get_friends_overview`, `get_notifications`.
- `handle_new_user()` trigger auto-provisions a profile (+ auto `@handle`) +
  a personal space + owner membership on signup.
- **Realtime:** `notifications` and `space_notes` are in the
  `supabase_realtime` publication; RLS still filters per subscriber.

---

## Where to build the frontend (page design & UI)

```
src/
  app/
    layout.tsx              # root layout: fonts, ThemeProvider, <Toaster>
    (site)/                 # authenticated app (sidebar shell)
      layout.tsx            # sidebar nav, backdrop, realtime providers
      page.tsx              # Home
      love-journey/page.tsx # Our Journey
      gallery/…             # Gallery (+ /footprints map)
      schedule/page.tsx     # Schedule
      friends/page.tsx      # Friends
      profile/page.tsx      # Profile
      settings/page.tsx     # Settings
    login/ · register/      # auth screens (no sidebar)
    api/…                   # a few REST routes (albums, timeline)
  components/               # all UI ("use client" for interactive pieces)
  config/navigation.ts      # sidebar tabs (add a route here)
  lib/
    actions/                # Server Actions (mutations)
    data.ts, space.ts, profile.ts, friends.ts, notifications.ts  # data reads
    supabase/               # server.ts (RLS client), client.ts (browser), service.ts (service-role)
    timezone.ts, storage.ts, …
  data/                     # shared TS types
supabase/                   # schema.sql + migration-*.sql (run in Supabase)
scripts/                    # one-off node scripts (migrations, RLS checks)
```

- **Pages** are server components in `src/app/(site)/<route>/page.tsx`; they
  fetch via the `src/lib` data functions and pass props to client components.
- **Reusable / interactive UI** lives in `src/components/*` (`"use client"`).
- **Add a sidebar tab** by appending to `src/config/navigation.ts`.
- **Mutations** go through Server Actions in `src/lib/actions/*`.
- **Styling:** Tailwind utility classes; global tokens in
  `src/app/globals.css`; dark mode via `next-themes` (`.dark` class).

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev                  # http://localhost:3000
npm run build                # production build / type-check
npm run lint
```

### Migrations workflow

Schema changes are SQL files in `supabase/` (`migration-*.sql`). The flow:

1. Write/adjust the migration SQL **and** mirror it into `schema.sql` (so a
   fresh install is complete).
2. Run the migration in the **Supabase SQL editor** _before_ deploying code
   that depends on it (some changes are otherwise breaking).
3. Verify (RLS/behavior) — see the `scripts/verify-*.mjs` examples — then
   commit & deploy.

The previous single-tenant SQL lives in `supabase/legacy-single-tenant/` for
reference and must **not** be run against this database.

---

## Deploying to Vercel

- Vercel watches `main`. **Pushing to `main` triggers a build and deploy** of
  the Next.js app automatically — no manual deploy step.
- Set the three environment variables (above) in the Vercel project; they're
  injected at build and runtime so the deployed app reaches Supabase.
- **Database first:** if a change includes a migration, run it in Supabase
  before (or together with) the push so the new code doesn't hit a missing
  column/table in production.

---

## Change history

See **[CHANGELOG.md](./CHANGELOG.md)** for the full, versioned history of
every update to Remember (v0.1.0 → current).
