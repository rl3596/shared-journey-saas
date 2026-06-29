-- ============================================================================
-- Phase 6 — Realtime notifications  ·  "Remember"
-- ============================================================================
-- Run ONCE in the Supabase SQL editor. Adds the notifications table to the
-- `supabase_realtime` publication so the app receives live INSERT events over
-- WebSockets. Idempotent (skips if already added).
--
-- RLS still applies to realtime: with the table's "notifications select" policy
-- (user_id = auth.uid()), each connected user only receives their own rows.
-- We only listen to INSERTs, so no REPLICA IDENTITY change is needed.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
