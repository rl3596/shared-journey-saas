-- ============================================================================
-- Phase 7 — Space Notes (shared sticky-note board)  ·  "Remember"
-- ============================================================================
-- Run ONCE in the Supabase SQL editor. Idempotent.
--
-- A lightweight per-space board of short notes. Any member can post; everyone
-- in the space sees them in real time. Authors manage their own notes.
-- ============================================================================

create table if not exists public.space_notes (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces (id)  on delete cascade,
  author_id  uuid not null references auth.users (id)     on delete cascade,
  content    text not null default '',
  color      text not null default 'amber',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists space_notes_space_idx
  on public.space_notes (space_id, created_at desc);

alter table public.space_notes enable row level security;

create policy "space_notes select" on public.space_notes
  for select using (public.is_space_member(space_id));
create policy "space_notes insert own" on public.space_notes
  for insert with check (author_id = auth.uid() and public.is_space_member(space_id));
create policy "space_notes update own" on public.space_notes
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "space_notes delete own" on public.space_notes
  for delete using (author_id = auth.uid());

drop trigger if exists space_notes_touch_updated_at on public.space_notes;
create trigger space_notes_touch_updated_at
  before update on public.space_notes
  for each row execute function public.touch_updated_at();

-- Realtime: stream new notes to space members over WebSockets (RLS applies, so
-- only members of the note's space receive it).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'space_notes'
  ) then
    alter publication supabase_realtime add table public.space_notes;
  end if;
end $$;
