# Shared Journey

A multi-tenant evolution of the couples-site project: individual user accounts
that collaborate inside **Shared Spaces** (couples now, families later).

This repo was forked from the single-tenant `couples-site` app. The UI and
features are inherited; the data model and auth are being re-architected around
the **Space** concept.

## Status — Phase 1 (in progress)

**Done**

- New project scaffolded from the single-tenant app (secrets intentionally NOT
  copied).
- Multi-tenant SQL schema: `supabase/schema.sql`
  - `spaces`, `profiles`, `space_members`
  - all content tables (`timeline_events`, `albums`, `schedule_events`) scoped
    by `space_id`
  - strict Row Level Security via a `is_space_member()` membership check
  - auto-provisioning trigger: new signup → profile + personal space + owner
    membership

**Next** (after Supabase env vars are supplied)

- Supabase Auth (`/login`, `/register`) + Next.js middleware route protection
- Sidebar avatar dropdown (Profile / Settings / Logout)
- Profile & Space settings pages
- Data-fetching refactor to the user's active `space_id`
- `scripts/migrate-to-space.js` — copy personal data from the old project into
  a new `space_id`

The previous single-tenant SQL lives in `supabase/legacy-single-tenant/` for
reference and must **not** be run against the new database.

## Setup

1. Create a new Supabase project.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. `cp .env.example .env.local` and fill in the values (see comments in the
   file). Note the shift from the old setup: the multi-tenant app needs the
   **public anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) because Supabase Auth
   and RLS run client-side; the service-role key stays server-only.
4. `npm install && npm run dev`.
