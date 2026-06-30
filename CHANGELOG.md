# Changelog

All notable changes to **Remember** are recorded here. Newest first.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/).
Dates are when the change landed on `main`. Changes that touch the database
ship with a matching SQL file under `supabase/` that is run in the Supabase
SQL editor before/with the deploy.

## [Unreleased]

_Nothing yet._

## [0.7.1] — 2026-06-30 — Documentation

- Added this version log (`CHANGELOG.md`) and rewrote `README.md` to cover the
  app, backend technologies, database structure, frontend layout, and the
  Supabase ↔ GitHub ↔ Vercel deployment flow.

## [0.7.0] — 2026-06-29 — Real-time & Space Notes

- **Real-time notifications** via Supabase Realtime — the bell updates over
  WebSockets (toast + live unread dot), no manual refresh.
- **Space Notes:** a realtime floating sticky-note board per space (hidden /
  collapsed "stacked deck" / expanded), with an unread red dot and an
  animated glow on new notes (framer-motion). Moved to the bottom-right.
- **Space Switcher:** a red dot flags new notes in your _other_ spaces
  (aggregate when collapsed, per-space when expanded).

## [0.6.0] — 2026-06-27 — Schedule calendar

- **Schedule:** a List/Calendar switch and a month calendar view with each
  day's events and month navigation.

## [0.5.0] — 2026-06-26 — Schedule, profile & space polish

- **Schedule:** per-event **time zones** (shown in the event's zone and
  converted to the viewer's) and a toggle to view **past events**.
- **Per-space background** image, editable by the space owner in Space
  Management (owner-only enforced by RLS trigger).
- **Profile:** collapsed to a single **Name** field; added **pronouns** and
  **personal links**; tap a friend to see their mini-profile.
- **Handles:** new accounts are **auto-assigned a searchable `@handle`**
  (editable later).
- Notifications are **removed once accepted/declined**.
- **Home counter** counts by the calendar (months/years), no seconds.
- Raised the Server Action body limit to fix large image-upload failures.
- Migrated legacy per-perspective journey text into per-member comments.

## [0.4.0] — 2026-06-25 — "Remember": Friends, Notifications, Spaces

- **Rebranded to "Remember."**
- **Friends system** (`/friends`): search by `@handle`/email, requests,
  accept/decline.
- **Unified Notifications** inbox powering the bell (friend + space-invite
  events); retired the old `space_invitations` flow.
- **Space Management overhaul:** master–detail view of all your spaces,
  create/delete, member list with owner badge, invite friends to a space.

## [0.3.0] — 2026-06-25 — Shared collaboration model

- **Per-member journey comments** with ownership rules (replaces the fixed
  dual-perspective text).
- **Member-attributed + joint schedule events** (create as yourself; multi-
  select others for joint events).
- Our Journey uses the shared app backdrop.

## [0.2.0] — 2026-06-24 — Identity & Spaces (Phase 2)

- Profile identity (handle system) + invitations schema; removed the splash
  screen.
- **Space Switcher**, user card, cookie-backed active-space state, Profile
  page.
- **Tabbed Settings** (account, appearance, space management, danger zone),
  invite flow, avatar upload, light/dark theme.
- Obvious Edit/Done toggle on the Our Journey page.

## [0.1.0] — 2026-06-23 — Multi-tenant foundation (Phase 1)

- Forked the single-tenant `couples-site` app into a multi-tenant SaaS
  (`shared-journey-saas`); secrets intentionally not copied.
- **Supabase Auth**, RLS-scoped data layer, signup onboarding, settings.
- Multi-tenant schema: `spaces`, `profiles`, `space_members`, and all content
  tables scoped by `space_id` with strict Row Level Security.

