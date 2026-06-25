-- ============================================================================
-- Phase 2 — member-attributed schedule events + joint events
-- Run ONCE in the Supabase SQL editor. Safe to re-run. NON-BREAKING: the
-- current schedule keeps working until the new UI ships.
-- ============================================================================
-- Replaces the fixed owner = 'Rui' | 'Wanyun' | 'Joint' model with:
--   • creator_id  — the member who created the event (their personal event)
--   • participant_ids[] — other members included (non-empty => "joint event")
-- Permissions: members read all events in the space; you may create events
-- only as yourself, and edit/delete only the events YOU created.
-- ============================================================================

alter table public.schedule_events
  add column if not exists creator_id      uuid references auth.users (id) on delete cascade,
  add column if not exists participant_ids uuid[] not null default '{}';

-- The legacy `owner` text column is no longer required.
alter table public.schedule_events alter column owner drop not null;

create index if not exists schedule_events_creator_idx
  on public.schedule_events (creator_id);

-- Auto-stamp creator_id = the inserting user when not provided. This keeps the
-- OLD app (which doesn't set creator_id) working under the new RLS, and makes
-- "you can only create events as yourself" impossible to spoof.
create or replace function public.set_schedule_creator()
returns trigger language plpgsql as $$
begin
  if new.creator_id is null then new.creator_id := auth.uid(); end if;
  return new;
end;
$$;
drop trigger if exists schedule_set_creator on public.schedule_events;
create trigger schedule_set_creator
  before insert on public.schedule_events
  for each row execute function public.set_schedule_creator();

-- Backfill creator_id on existing rows = the space owner (they were created in
-- the single-user era). Joint events lose their "joint" flag for now since the
-- other person isn't a user yet; the owner can re-add participants later.
update public.schedule_events e
   set creator_id = m.user_id
  from public.space_members m
 where m.space_id = e.space_id
   and m.role = 'owner'
   and e.creator_id is null;

-- RLS: members read all; create as yourself; edit/delete only your own.
drop policy if exists "schedule member all" on public.schedule_events;

drop policy if exists "schedule select" on public.schedule_events;
create policy "schedule select" on public.schedule_events
  for select using (public.is_space_member(space_id));

drop policy if exists "schedule insert own" on public.schedule_events;
create policy "schedule insert own" on public.schedule_events
  for insert with check (
    creator_id = auth.uid() and public.is_space_member(space_id)
  );

drop policy if exists "schedule update own" on public.schedule_events;
create policy "schedule update own" on public.schedule_events
  for update using (creator_id = auth.uid())
              with check (creator_id = auth.uid());

drop policy if exists "schedule delete own" on public.schedule_events;
create policy "schedule delete own" on public.schedule_events
  for delete using (creator_id = auth.uid());
