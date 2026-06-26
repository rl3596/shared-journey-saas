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

-- Is `target_user` the OWNER of the space? (used by milestone + comment RLS)
create or replace function public.is_space_owner(target_space_id uuid, target_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.space_members m
     where m.space_id = target_space_id and m.user_id = target_user
       and m.role = 'owner'
  );
$$;

-- Does the current user share any space with `other`? (lets co-members read
-- each other's profiles for names/avatars).
create or replace function public.shares_space_with(other uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.space_members a
      join public.space_members b on a.space_id = b.space_id
     where a.user_id = auth.uid() and b.user_id = other
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
  id              text primary key default gen_random_uuid()::text,
  space_id        uuid not null references public.spaces (id) on delete cascade,
  creator_id      uuid references auth.users (id) on delete cascade, -- whose event
  participant_ids uuid[] not null default '{}',  -- other members (non-empty = joint)
  owner           text,               -- legacy label (unused)
  title           text not null,
  date            text not null,          -- YYYY-MM-DD
  time            text not null default '', -- HH:MM (24h), in `timezone`
  timezone        text not null default '', -- IANA zone the time is expressed in
  notes           text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists schedule_events_space_idx on public.schedule_events (space_id);
create index if not exists schedule_events_creator_idx on public.schedule_events (creator_id);

-- Auto-stamp the creator so "create only as yourself" can't be spoofed.
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
-- Co-members can read each other's profiles (names/avatars on comments etc.).
create policy "profiles shared-space select" on public.profiles
  for select using (public.shares_space_with(id));

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

-- Milestones: readable by members, but only the OWNER can create/edit/delete
-- (members contribute per-milestone comments instead — see timeline_comments).
create policy "timeline select" on public.timeline_events
  for select using (public.is_space_member(space_id));
create policy "timeline owner insert" on public.timeline_events
  for insert with check (public.is_space_owner(space_id, auth.uid()));
create policy "timeline owner update" on public.timeline_events
  for update using (public.is_space_owner(space_id, auth.uid()))
              with check (public.is_space_owner(space_id, auth.uid()));
create policy "timeline owner delete" on public.timeline_events
  for delete using (public.is_space_owner(space_id, auth.uid()));

-- other content tables — full CRUD for members of the row's space.
create policy "albums member all" on public.albums
  for all using (public.is_space_member(space_id))
          with check (public.is_space_member(space_id));

-- schedule: members read all; create as yourself; edit/delete only your own.
create policy "schedule select" on public.schedule_events
  for select using (public.is_space_member(space_id));
create policy "schedule insert own" on public.schedule_events
  for insert with check (creator_id = auth.uid() and public.is_space_member(space_id));
create policy "schedule update own" on public.schedule_events
  for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "schedule delete own" on public.schedule_events
  for delete using (creator_id = auth.uid());

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
  new_space_id     uuid;
  default_username text;
  base_handle      text;
  candidate        text;
begin
  default_username := coalesce(nullif(split_part(new.email, '@', 1), ''), 'friend');

  -- Auto-assign a unique, valid @handle so new users are immediately searchable
  -- on the Friends page (they can change it on their Profile later).
  base_handle := btrim(
    regexp_replace(
      regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '_', 'g'),
      '_+', '_', 'g'
    ), '_');
  if length(base_handle) = 0 then
    base_handle := 'friend';
  end if;
  base_handle := left(base_handle, 24);

  candidate := base_handle;
  while length(candidate) < 3
        or exists (select 1 from public.profiles where handle = candidate) loop
    candidate := base_handle || '_' || (floor(random() * 9000 + 1000)::int)::text;
  end loop;

  insert into public.profiles (id, username, handle)
  values (new.id, default_username, candidate);

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

-- ----------------------------------------------------------------------------
-- 8 · Per-member journey comments (Phase 2)
-- ----------------------------------------------------------------------------
create table if not exists public.timeline_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   text not null references public.timeline_events (id) on delete cascade,
  space_id   uuid not null references public.spaces (id)          on delete cascade,
  author_id  uuid not null references auth.users (id)             on delete cascade,
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, author_id)
);
create index if not exists timeline_comments_event_idx on public.timeline_comments (event_id);
create index if not exists timeline_comments_space_idx on public.timeline_comments (space_id);

alter table public.timeline_comments enable row level security;

create policy "comments select" on public.timeline_comments
  for select using (public.is_space_member(space_id));
create policy "comments insert own" on public.timeline_comments
  for insert with check (author_id = auth.uid() and public.is_space_member(space_id));
create policy "comments update own" on public.timeline_comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
-- delete your own comment, but never the space owner's comment.
create policy "comments delete own" on public.timeline_comments
  for delete using (
    author_id = auth.uid() and not public.is_space_owner(space_id, author_id)
  );

drop trigger if exists comments_touch_updated_at on public.timeline_comments;
create trigger comments_touch_updated_at
  before update on public.timeline_comments
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 9 · Friends + unified Notifications (Phase 3)
-- ----------------------------------------------------------------------------
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'rejected')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_unique
  on public.friendships (least(requester_id, addressee_id),
                         greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

drop trigger if exists friendships_touch_updated_at on public.friendships;
create trigger friendships_touch_updated_at
  before update on public.friendships
  for each row execute function public.touch_updated_at();

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  sender_id    uuid references auth.users (id) on delete set null,
  type         text not null check (type in (
                 'friend_request', 'friend_accepted', 'friend_rejected',
                 'space_invite',   'space_accepted',  'space_rejected'
               )),
  reference_id uuid,
  message      text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.friendships   enable row level security;
alter table public.notifications enable row level security;

create policy "friendships select" on public.friendships
  for select using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "friendships insert" on public.friendships
  for insert with check (requester_id = auth.uid() and addressee_id <> auth.uid());
create policy "friendships update" on public.friendships
  for update using (requester_id = auth.uid() or addressee_id = auth.uid())
              with check (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "friendships delete" on public.friendships
  for delete using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "notifications select" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications insert" on public.notifications
  for insert with check (sender_id = auth.uid());
create policy "notifications update" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications delete" on public.notifications
  for delete using (user_id = auth.uid());

drop function if exists public.get_friends_overview();
create or replace function public.get_friends_overview()
returns table (
  friendship_id uuid, other_id uuid, handle text, name text, avatar_url text,
  location text, bio text,
  status text, direction text, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    f.id,
    case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end,
    p.handle,
    coalesce(nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), p.username),
    p.avatar_url,
    p.location,
    p.bio,
    f.status,
    case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid()
                   then f.addressee_id else f.requester_id end
  where f.requester_id = auth.uid() or f.addressee_id = auth.uid();
$$;
revoke all on function public.get_friends_overview() from public, anon;
grant execute on function public.get_friends_overview() to authenticated;

create or replace function public.get_notifications()
returns table (
  id uuid, type text, reference_id uuid, message text, is_read boolean,
  created_at timestamptz, sender_id uuid, sender_handle text, sender_name text,
  sender_avatar text, space_name text
)
language sql stable security definer set search_path = public
as $$
  select
    n.id, n.type, n.reference_id, n.message, n.is_read, n.created_at,
    n.sender_id, sp.handle,
    coalesce(nullif(btrim(coalesce(sp.first_name,'') || ' ' || coalesce(sp.last_name,'')), ''), sp.username),
    sp.avatar_url,
    s.name
  from public.notifications n
  left join public.profiles sp on sp.id = n.sender_id
  left join public.spaces s
    on s.id = n.reference_id
   and n.type in ('space_invite', 'space_accepted', 'space_rejected')
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 50;
$$;
revoke all on function public.get_notifications() from public, anon;
grant execute on function public.get_notifications() to authenticated;

-- ============================================================================
-- Follow-ups handled in later phases (not in this file):
--   • Supabase Storage bucket + per-space RLS policies for photo uploads.
--   • Optional normalized `photos` table (currently albums.image_urls[]).
--   • Space Message Boards + Friend Direct Messaging (build on friendships +
--     notifications above).
-- ============================================================================
