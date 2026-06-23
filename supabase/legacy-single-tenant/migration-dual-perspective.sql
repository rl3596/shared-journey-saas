-- Dual-perspective milestones.
--
-- Run this once in your Supabase SQL editor BEFORE the new app code is
-- deployed. It adds two nullable text columns to timeline_events
-- (content_rui, content_wanyun) and backfills content_rui from the
-- existing `description` so no memories are lost.
--
-- The original `description` column is kept around as a safety net; once
-- you've reviewed every milestone in the new dual-perspective UI you can
-- optionally drop it with:
--   alter table timeline_events drop column description;

alter table timeline_events
  add column if not exists content_rui text not null default '',
  add column if not exists content_wanyun text not null default '';

-- Backfill: copy existing description into content_rui where we haven't
-- written a new one yet. Safe to re-run.
update timeline_events
   set content_rui = description
 where coalesce(content_rui, '') = ''
   and coalesce(description, '') <> '';

-- Relax the legacy NOT NULL on description so new code (which no longer
-- writes to it) can still insert rows. Safe to re-run.
alter table timeline_events
  alter column description drop not null;
