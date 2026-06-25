-- ============================================================================
-- Phase 2 — per-member journey comments + ownership rules
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ============================================================================
-- Replaces the hardcoded content_rui / content_wanyun model with real
-- per-member comments on each milestone:
--   • one comment per person per milestone
--   • members manage ONLY their own comment
--   • the space owner's comment cannot be deleted
--   • only the space OWNER can create / edit / delete milestones
-- The old content_rui / content_wanyun columns are kept (not dropped) so no
-- data is lost; the owner's content_rui is migrated into a comment.
-- ============================================================================

-- 1) Helpers ----------------------------------------------------------------

-- Is `target_user` the OWNER of `target_space_id`? DEFINER to avoid recursion.
create or replace function public.is_space_owner(target_space_id uuid, target_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.space_members m
     where m.space_id = target_space_id
       and m.user_id  = target_user
       and m.role     = 'owner'
  );
$$;

-- Does the current user share ANY space with `other`? Used to let space
-- co-members read each other's profiles (names/avatars on comments, etc.).
create or replace function public.shares_space_with(other uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from public.space_members a
      join public.space_members b on a.space_id = b.space_id
     where a.user_id = auth.uid()
       and b.user_id = other
  );
$$;

-- 2) Let co-members read each other's profiles ------------------------------
-- (Additional permissive SELECT policy — OR'd with the existing self policy.)
drop policy if exists "profiles shared-space select" on public.profiles;
create policy "profiles shared-space select" on public.profiles
  for select using (public.shares_space_with(id));

-- 3) Restrict milestone management to the space owner -----------------------
drop policy if exists "timeline member all" on public.timeline_events;

drop policy if exists "timeline select" on public.timeline_events;
create policy "timeline select" on public.timeline_events
  for select using (public.is_space_member(space_id));

drop policy if exists "timeline owner insert" on public.timeline_events;
create policy "timeline owner insert" on public.timeline_events
  for insert with check (public.is_space_owner(space_id, auth.uid()));

drop policy if exists "timeline owner update" on public.timeline_events;
create policy "timeline owner update" on public.timeline_events
  for update using (public.is_space_owner(space_id, auth.uid()))
              with check (public.is_space_owner(space_id, auth.uid()));

drop policy if exists "timeline owner delete" on public.timeline_events;
create policy "timeline owner delete" on public.timeline_events
  for delete using (public.is_space_owner(space_id, auth.uid()));

-- 4) Comments table ---------------------------------------------------------
create table if not exists public.timeline_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   text not null references public.timeline_events (id) on delete cascade,
  space_id   uuid not null references public.spaces (id)          on delete cascade,
  author_id  uuid not null references auth.users (id)             on delete cascade,
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, author_id) -- one comment per person per milestone
);
create index if not exists timeline_comments_event_idx on public.timeline_comments (event_id);
create index if not exists timeline_comments_space_idx on public.timeline_comments (space_id);

alter table public.timeline_comments enable row level security;

-- Read: any member of the space.
drop policy if exists "comments select" on public.timeline_comments;
create policy "comments select" on public.timeline_comments
  for select using (public.is_space_member(space_id));

-- Insert: a member, writing their OWN comment.
drop policy if exists "comments insert own" on public.timeline_comments;
create policy "comments insert own" on public.timeline_comments
  for insert with check (
    author_id = auth.uid() and public.is_space_member(space_id)
  );

-- Update: only your own comment.
drop policy if exists "comments update own" on public.timeline_comments;
create policy "comments update own" on public.timeline_comments
  for update using (author_id = auth.uid())
              with check (author_id = auth.uid());

-- Delete: only your own comment, AND never the space owner's comment.
drop policy if exists "comments delete own" on public.timeline_comments;
create policy "comments delete own" on public.timeline_comments
  for delete using (
    author_id = auth.uid()
    and not public.is_space_owner(space_id, author_id)
  );

drop trigger if exists comments_touch_updated_at on public.timeline_comments;
create trigger comments_touch_updated_at
  before update on public.timeline_comments
  for each row execute function public.touch_updated_at();

-- 5) Migrate existing content_rui into the owner's comment ------------------
-- content_wanyun is preserved in its column (not migrated, not lost).
insert into public.timeline_comments (event_id, space_id, author_id, content)
select e.id, e.space_id, m.user_id, e.content_rui
  from public.timeline_events e
  join public.space_members m on m.space_id = e.space_id and m.role = 'owner'
 where coalesce(e.content_rui, '') <> ''
on conflict (event_id, author_id) do nothing;
