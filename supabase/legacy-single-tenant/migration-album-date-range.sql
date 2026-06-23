-- Multi-day events for the gallery.
--
-- Run this once in your Supabase SQL editor. It adds a nullable `end_date`
-- column to `albums`. Existing single-day events keep `end_date` NULL and
-- continue to render as a single date — no data change needed.

alter table albums
  add column if not exists end_date text;
