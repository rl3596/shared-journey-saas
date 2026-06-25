-- ============================================================================
-- Phase 3 — Friends system + unified Notifications  ·  "Remember"
-- ============================================================================
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE /
-- guarded inserts).
--
-- What this adds
--   • friendships          — friend relationships (pending/accepted/rejected)
--   • notifications        — one unified inbox powering the bell. Friend
--                            requests, space invites, and their result
--                            messages all live here.
--   • RLS                  — strict, owner-of-row only.
--   • get_friends_overview / get_notifications — SECURITY DEFINER read RPCs so
--     we can show a not-yet-friend's name/avatar (and a space's name to an
--     invitee) without widening the profiles policy.
--   • A one-time migration of any PENDING space_invitations into notifications.
--
-- The old space_invitations table + its RPCs are left in place but are no
-- longer used by the app (superseded by space_invite notifications).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1 · friendships
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

-- One relationship per unordered pair: (A,B) and (B,A) collide.
create unique index if not exists friendships_pair_unique
  on public.friendships (least(requester_id, addressee_id),
                         greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

drop trigger if exists friendships_touch_updated_at on public.friendships;
create trigger friendships_touch_updated_at
  before update on public.friendships
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2 · notifications (unified inbox)
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade, -- recipient
  sender_id    uuid references auth.users (id) on delete set null,
  type         text not null check (type in (
                 'friend_request', 'friend_accepted', 'friend_rejected',
                 'space_invite',   'space_accepted',  'space_rejected'
               )),
  reference_id uuid,            -- friendship_id (friend_*) or space_id (space_*)
  message      text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, is_read, created_at desc);

-- ----------------------------------------------------------------------------
-- 3 · Row Level Security — strictly owner-of-row
-- ----------------------------------------------------------------------------
alter table public.friendships   enable row level security;
alter table public.notifications enable row level security;

-- friendships: visible to / managed by either party.
drop policy if exists "friendships select" on public.friendships;
create policy "friendships select" on public.friendships
  for select using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "friendships insert" on public.friendships;
create policy "friendships insert" on public.friendships
  for insert with check (requester_id = auth.uid() and addressee_id <> auth.uid());
drop policy if exists "friendships update" on public.friendships;
create policy "friendships update" on public.friendships
  for update using (requester_id = auth.uid() or addressee_id = auth.uid())
              with check (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "friendships delete" on public.friendships;
create policy "friendships delete" on public.friendships
  for delete using (requester_id = auth.uid() or addressee_id = auth.uid());

-- notifications: you see and manage only the ones addressed to you; you may
-- create one only when you are the sender (lets you notify anyone — inherent
-- to friend requests — but never forge another sender).
drop policy if exists "notifications select" on public.notifications;
create policy "notifications select" on public.notifications
  for select using (user_id = auth.uid());
drop policy if exists "notifications insert" on public.notifications;
create policy "notifications insert" on public.notifications
  for insert with check (sender_id = auth.uid());
drop policy if exists "notifications update" on public.notifications;
create policy "notifications update" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications delete" on public.notifications;
create policy "notifications delete" on public.notifications
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4 · Enriched read RPCs (DEFINER — join profiles/spaces across RLS)
-- ----------------------------------------------------------------------------

-- Every friendship I'm part of, with the OTHER party's profile + direction.
create or replace function public.get_friends_overview()
returns table (
  friendship_id uuid, other_id uuid, handle text, name text, avatar_url text,
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

-- My notifications, enriched with the sender's profile and (for space_* types)
-- the space's name.
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

-- ----------------------------------------------------------------------------
-- 5 · One-time migration: pending space_invitations → space_invite notifications
-- ----------------------------------------------------------------------------
insert into public.notifications (user_id, sender_id, type, reference_id, created_at)
select i.invitee_id, i.inviter_id, 'space_invite', i.space_id, i.created_at
  from public.space_invitations i
 where i.status = 'pending'
   and not exists (
     select 1 from public.notifications n
      where n.user_id = i.invitee_id
        and n.type = 'space_invite'
        and n.reference_id = i.space_id
        and n.sender_id = i.inviter_id
   );

-- ============================================================================
-- Done. The app reads friendships/notifications via the RPCs above; all writes
-- go through RLS (friendships, notifications) except the privileged
-- space_members insert on "Join", which a server action performs with the
-- service-role key after validating the space_invite notification.
-- ============================================================================
