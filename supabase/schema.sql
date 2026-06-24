-- ============================================================================
-- Shared Journey — multi-tenant ("Space") schema  ·  Phase 1
-- ============================================================================
-- Run ONCE in the NEW Supabase project's SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Architecture
--   • Every piece of content belongs to a SPACE (a couple / family unit).
--   • Users are linked to spaces through SPACE_MEMBERS.
--   • Row Level Security lets a user touch a content row ONLY when their
--     auth.uid() is a member of that row's space.
--   • On signup, a trigger auto-provisions a profile + a personal space and
--     makes the new user that space's owner. (No invite UI yet — Phase 2.)
--
-- The old single-tenant SQL is preserved under supabase/legacy-single-tenant/
-- for reference; do NOT run it against this project.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1 · SaaS layer
-- ----------------------------------------------------------------------------

create table if not exists public.spaces (
  id               uuid primary key default gen_random_uuid(),
  name             text not null default 'Our Space',
  anniversary_date date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text,                 -- display name
  handle      text,                 -- @handle, unique; lowercase [a-z0-9_]{3,30}
  first_name  text,
  last_name   text,
  location    text,
  bio         text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_handle_format
    check (handle is null or handle ~ '^[a-z0-9_]{3,30}$')
);
create unique index if not exists profiles_handle_unique on public.profiles (handle);

create table if not exists public.space_invitations (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces (id)  on delete cascade,
  inviter_id uuid not null references auth.users (id)     on delete cascade,
  invitee_id uuid not null references auth.users (id)     on delete cascade,
  status     text not null default 'pending'
             check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (space_id, invitee_id)
);
create index if not exists space_invitations_invitee_idx
  on public.space_invitations (invitee_id, status);
create index if not exists space_invitations_space_idx
  on public.space_invitations (space_id);

create table if not exists public.space_members (
  space_id   uuid not null references public.spaces (id)     on delete cascade,
  user_id    uuid not null references auth.users (id)        on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index if not exists space_members_user_idx on public.space_members (user_id);

-- ----------------------------------------------------------------------------
-- 2 · Membership helper
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so it runs as the owner and bypasses RLS internally — this
-- is what prevents infinite recursion when the policy on space_members (or any
-- content table) needs to consult space_members.

create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.space_members m
     where m.space_id = target_space_id
       and m.user_id  = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 3 · Content tables (every row scoped by space_id)
-- ----------------------------------------------------------------------------
-- Names + columns mirror the existing app so the data-layer refactor and the
-- migration script stay 1:1. Each gains a `space_id` FK + index.
--
-- NOTE: photos are still denormalized as albums.image_urls (text[]); since
-- albums carry space_id, photos inherit isolation. Normalizing into a
-- dedicated `photos` table is a clean Phase-2 step and needs no schema-shape
-- change here.

create table if not exists public.timeline_events (
  id              text primary key default gen_random_uuid()::text,
  space_id        uuid not null references public.spaces (id) on delete cascade,
  date            text not null,
  title           text not null,
  content_rui     text not null default '',
  content_wanyun  text not null default '',
  location        text not null default '',
  image           text,
  created_at      timestamptz not null default now()
);
create index if not exists timeline_events_space_idx on public.timeline_events (space_id);

create table if not exists public.albums (
  id               text primary key default gen_random_uuid()::text,
  space_id         uuid not null references public.spaces (id) on delete cascade,
  title            text not null,
  location         text not null default '',
  date             text not null,
  end_date         text,
  cover_image_url  text,
  pinned_at        timestamptz,
  latitude         double precision,
  longitude        double precision,
  image_urls       text[] not null default '{}',
  created_at       timestamptz not null default now()
);
create index if not exists albums_space_idx on public.albums (space_id);

create table if not exists public.schedule_events (
  id         text primary key default gen_random_uuid()::text,
  space_id   uuid not null references public.spaces (id) on delete cascade,
  owner      text not null,          -- space-specific member label (no hard CHECK)
  title      text not null,
  date       text not null,          -- YYYY-MM-DD
  time       text not null default '', -- HH:MM (24h)
  notes      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists schedule_events_space_idx on public.schedule_events (space_id);

-- Atomic append for albums.image_urls (race-free concurrent photo uploads).
-- SECURITY INVOKER (default): RLS still applies, so a caller can only append
-- to albums in a space they belong to.
create or replace function public.append_album_image(album_id text, new_url text)
returns void
language sql
as $$
  update public.albums
     set image_urls = array_append(image_urls, new_url)
   where id = album_id;
$$;

-- ----------------------------------------------------------------------------
-- 4 · Row Level Security
-- ----------------------------------------------------------------------------

alter table public.spaces          enable row level security;
alter table public.profiles        enable row level security;
alter table public.space_members   enable row level security;
alter table public.timeline_events enable row level security;
alter table public.albums          enable row level security;
alter table public.schedule_events enable row level security;

-- profiles — manage your own row only.
create policy "profiles self select" on public.profiles
  for select using (id = auth.uid());
create policy "profiles self insert" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles self update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- spaces — members may read & update; creation happens only via the signup
-- trigger (SECURITY DEFINER), so no INSERT policy is exposed in Phase 1.
create policy "spaces member select" on public.spaces
  for select using (public.is_space_member(id));
create policy "spaces member update" on public.spaces
  for update using (public.is_space_member(id))
              with check (public.is_space_member(id));

-- space_members — you can read membership rows for spaces you belong to.
-- Inserts come only from the signup trigger (no invite system yet).
create policy "space_members member select" on public.space_members
  for select using (public.is_space_member(space_id));

-- content tables — full CRUD for members of the row's space. FOR ALL covers
-- SELECT / INSERT / UPDATE / DELETE with one policy each.
create policy "timeline member all" on public.timeline_events
  for all using (public.is_space_member(space_id))
          with check (public.is_space_member(space_id));

create policy "albums member all" on public.albums
  for all using (public.is_space_member(space_id))
          with check (public.is_space_member(space_id));

create policy "schedule member all" on public.schedule_events
  for all using (public.is_space_member(space_id))
          with check (public.is_space_member(space_id));

-- ----------------------------------------------------------------------------
-- 5 · Auto-provision profile + default space on signup
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_space_id uuid;
  default_username text;
begin
  default_username := coalesce(nullif(split_part(new.email, '@', 1), ''), 'friend');

  insert into public.profiles (id, username)
  values (new.id, default_username);

  insert into public.spaces (name)
  values ('My Space')
  returning id into new_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (new_space_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6 · updated_at touch trigger (spaces, profiles)
-- ----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists spaces_touch_updated_at on public.spaces;
create trigger spaces_touch_updated_at
  before update on public.spaces
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 7 · Invitations RLS + member-search / invite RPCs (Phase 2)
-- ----------------------------------------------------------------------------

alter table public.space_invitations enable row level security;

create policy "invitations select" on public.space_invitations
  for select using (invitee_id = auth.uid() or public.is_space_member(space_id));
create policy "invitations insert" on public.space_invitations
  for insert with check (inviter_id = auth.uid() and public.is_space_member(space_id));
create policy "invitations delete" on public.space_invitations
  for delete using (public.is_space_member(space_id));

-- Exact handle/email lookup (no enumeration); reads auth.users via DEFINER.
create or replace function public.search_profile(query text)
returns table (id uuid, handle text, username text, first_name text, last_name text, avatar_url text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.handle, p.username, p.first_name, p.last_name, p.avatar_url
    from public.profiles p
    join auth.users u on u.id = p.id
   where btrim(coalesce(query, '')) <> ''
     and (p.handle = lower(btrim(query)) or lower(u.email) = lower(btrim(query)))
   limit 5;
$$;
revoke all on function public.search_profile(text) from public, anon;
grant execute on function public.search_profile(text) to authenticated;

-- Enriched pending invitations for the current user (space/inviter names).
create or replace function public.get_pending_invitations()
returns table (id uuid, space_id uuid, space_name text, inviter_id uuid,
               inviter_handle text, inviter_name text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select i.id, i.space_id, s.name, i.inviter_id, ip.handle,
         coalesce(nullif(btrim(coalesce(ip.first_name,'') || ' ' || coalesce(ip.last_name,'')), ''), ip.username),
         i.created_at
    from public.space_invitations i
    join public.spaces s on s.id = i.space_id
    left join public.profiles ip on ip.id = i.inviter_id
   where i.invitee_id = auth.uid() and i.status = 'pending'
   order by i.created_at desc;
$$;
revoke all on function public.get_pending_invitations() from public, anon;
grant execute on function public.get_pending_invitations() to authenticated;

-- Accept inserts the membership here (DEFINER) so space_members stays locked.
create or replace function public.accept_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare inv public.space_invitations;
begin
  select * into inv from public.space_invitations
   where id = invitation_id and invitee_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Invitation not found or not pending'; end if;
  insert into public.space_members (space_id, user_id, role)
  values (inv.space_id, auth.uid(), 'member')
  on conflict (space_id, user_id) do nothing;
  update public.space_invitations set status = 'accepted' where id = invitation_id;
end;
$$;
revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

create or replace function public.decline_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.space_invitations set status = 'declined'
   where id = invitation_id and invitee_id = auth.uid() and status = 'pending';
end;
$$;
revoke all on function public.decline_invitation(uuid) from public, anon;
grant execute on function public.decline_invitation(uuid) to authenticated;

-- ============================================================================
-- Follow-ups handled in later phases (not in this file):
--   • Supabase Storage bucket + per-space RLS policies for photo uploads.
--   • Optional normalized `photos` table (currently albums.image_urls[]).
--   • Generalizing content_rui / content_wanyun and schedule owner from fixed
--     names to per-member references once the invite/member UI exists.
-- ============================================================================
