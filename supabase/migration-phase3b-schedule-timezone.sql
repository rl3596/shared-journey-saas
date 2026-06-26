-- ============================================================================
-- Phase 3b — Schedule time zones  ·  "Remember"
-- ============================================================================
-- Run ONCE in the Supabase SQL editor. Idempotent and non-breaking: adds a
-- single column. Existing rows get '' (unknown zone) and are rendered in the
-- viewer's local zone, exactly as before.
--
-- `timezone` holds the IANA name (e.g. 'America/New_York') the event's time is
-- expressed in. The app shows the event in its own zone AND converts it to each
-- viewer's local zone so couples in different zones know "what time is that".
-- ============================================================================

alter table public.schedule_events
  add column if not exists timezone text not null default '';
