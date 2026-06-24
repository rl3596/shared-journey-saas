-- ============================================================================
-- Phase 2 — profile identity, invitations, secure search
-- Run ONCE in the new project's Supabase SQL editor. Safe to re-run.
-- ============================================================================

-- 1) Profiles: public identity columns --------------------------------------
alter table public.profiles
  add column if not exists handle     text,
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists location   text,
  add column if not exists bio        text;

-- handle: lowercase alphanumeric + underscore, 3–30 chars (or NULL).
alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles
  add constraint profiles_handle_format
  check (handle is null or handle ~ '^[a-z0-9_]{3,30}$');

-- Unique handle (lowercase-only by the check above, so this is case-insensitive).
create unique index if not exists profiles_handle_unique on public.profiles (handle);

-- 2) Invitations ------------------------------------------------------------
create table if not exists public.space_invitations (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces (id)  on delete cascade,
  inviter_id uuid not null references auth.users (id)     on delete cascade,
  invitee_id uuid not null references auth.users (id)     on delete cascade,
  status     text not null default 'pending'
             check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (space_id, invitee_id) -- one outstanding invite per person per space
);
create index if not exists space_invitations_invitee_idx
  on public.space_invitations (invitee_id, status);
create index if not exists space_invitations_space_idx
  on public.space_invitations (space_id);

alter table public.space_invitations enable row level security;

-- Invitee sees their own invites; space members see invites for their space.
drop policy if exists "invitations select" on public.space_invitations;
create policy "invitations select" on public.space_invitations
  for select using (
    invitee_id = auth.uid() or public.is_space_member(space_id)
  );

-- A space member can create an invite for their space, as themselves.
drop policy if exists "invitations insert" on public.space_invitations;
create policy "invitations insert" on public.space_invitations
  for insert with check (
    inviter_id = auth.uid() and public.is_space_member(space_id)
  );

-- A space member can rescind (delete) an invite for their space.
drop policy if exists "invitations delete" on public.space_invitations;
create policy "invitations delete" on public.space_invitations
  for delete using (public.is_space_member(space_id));

-- Status changes (accept/decline) go through the SECURITY DEFINER RPCs below,
-- so no UPDATE policy is exposed.

-- 3) Secure profile search — exact handle OR email only ---------------------
-- SECURITY DEFINER so it can read auth.users + bypass the self-only profiles
-- policy for this controlled lookup. Exact match (no LIKE/wildcards) prevents
-- dumping/enumerating the user base.
create or replace function public.search_profile(query text)
returns table (
  id uuid,
  handle text,
  username text,
  first_name text,
  last_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.username, p.first_name, p.last_name, p.avatar_url
    from public.profiles p
    join auth.users u on u.id = p.id
   where btrim(coalesce(query, '')) <> ''
     and (
       p.handle = lower(btrim(query))
       or lower(u.email) = lower(btrim(query))
     )
   limit 5;
$$;
revoke all on function public.search_profile(text) from public, anon;
grant execute on function public.search_profile(text) to authenticated;

-- 4) Pending invitations for the current user (enriched) --------------------
-- The invitee isn't a member of the inviting space yet, so they can't read the
-- spaces row via RLS — this DEFINER function returns the space + inviter names.
create or replace function public.get_pending_invitations()
returns table (
  id uuid,
  space_id uuid,
  space_name text,
  inviter_id uuid,
  inviter_handle text,
  inviter_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.space_id,
    s.name as space_name,
    i.inviter_id,
    ip.handle as inviter_handle,
    coalesce(
      nullif(btrim(coalesce(ip.first_name, '') || ' ' || coalesce(ip.last_name, '')), ''),
      ip.username
    ) as inviter_name,
    i.created_at
  from public.space_invitations i
  join public.spaces s on s.id = i.space_id
  left join public.profiles ip on ip.id = i.inviter_id
  where i.invitee_id = auth.uid() and i.status = 'pending'
  order by i.created_at desc;
$$;
revoke all on function public.get_pending_invitations() from public, anon;
grant execute on function public.get_pending_invitations() to authenticated;

-- 5) Accept / decline an invitation -----------------------------------------
-- Accepting inserts the membership here (DEFINER) so space_members stays locked
-- down — there's no general "users can add themselves to spaces" policy.
create or replace function public.accept_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.space_invitations;
begin
  select * into inv
    from public.space_invitations
   where id = invitation_id
     and invitee_id = auth.uid()
     and status = 'pending';
  if not found then
    raise exception 'Invitation not found or not pending';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (inv.space_id, auth.uid(), 'member')
  on conflict (space_id, user_id) do nothing;

  update public.space_invitations
     set status = 'accepted'
   where id = invitation_id;
end;
$$;
revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

create or replace function public.decline_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.space_invitations
     set status = 'declined'
   where id = invitation_id
     and invitee_id = auth.uid()
     and status = 'pending';
end;
$$;
revoke all on function public.decline_invitation(uuid) from public, anon;
grant execute on function public.decline_invitation(uuid) to authenticated;

-- 6) Backfill handles for existing accounts ---------------------------------
-- Derives a valid handle from the username (or 'user') plus a short uuid
-- suffix for uniqueness. Only fills NULL handles, so it's safe to re-run.
update public.profiles p
   set handle = sub.h
  from (
    select id,
           substr(
             regexp_replace(lower(coalesce(username, 'user')), '[^a-z0-9_]', '_', 'g'),
             1, 20
           ) || '_' || substr(replace(id::text, '-', ''), 1, 6) as h
      from public.profiles
     where handle is null
  ) sub
 where p.id = sub.id and p.handle is null;
