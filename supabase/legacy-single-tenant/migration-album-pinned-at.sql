-- "Pin to top" support for albums.
--
-- Adds a nullable timestamp column. When pinned_at IS NULL the album is
-- unpinned (normal date sort applies). When pinned_at IS NOT NULL the
-- album sits in the pinned strip at the very top of the gallery, ordered
-- by pinned_at desc (most recent pin first).
--
-- Pin/unpin is gated behind the same hidden 5-click-on-the-Us-icon mode
-- as the Journey edit affordances, so casual viewers never see the UI.
--
-- Run this once in your Supabase SQL editor. Safe to re-run.

alter table albums
  add column if not exists pinned_at timestamptz;
