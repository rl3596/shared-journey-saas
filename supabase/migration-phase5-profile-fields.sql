-- ============================================================================
-- Phase 5 — Single "name" + pronouns + links on profiles  ·  "Remember"
-- ============================================================================
-- Run ONCE in the Supabase SQL editor. Idempotent.
--
-- The profile now uses ONE name field (profiles.username) instead of
-- username + first_name + last_name. This migration:
--   • adds `pronouns` and `links` columns,
--   • folds any existing first/last name into `username` so the single Name
--     field keeps showing what people already saw, then clears first/last,
--   • repoints the read RPCs to resolve names from `username` only.
--
-- first_name/last_name columns are kept (now empty) so older RPCs that still
-- reference them keep working; nothing reads them for display anymore.
-- ============================================================================

alter table public.profiles add column if not exists pronouns text;
alter table public.profiles add column if not exists links    text;

-- Fold "First Last" into the single name, then clear the parts.
update public.profiles
   set username = coalesce(
         nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''),
         username)
 where coalesce(first_name, '') <> '' or coalesce(last_name, '') <> '';

update public.profiles
   set first_name = null, last_name = null
 where first_name is not null or last_name is not null;

-- Notifications: sender name from username (fallback to @handle).
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
    coalesce(nullif(btrim(sp.username), ''), '@' || sp.handle),
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

-- Friends overview: name from username; also expose pronouns + links for the
-- friend mini-profile. (Return columns change, so drop + recreate.)
drop function if exists public.get_friends_overview();
create or replace function public.get_friends_overview()
returns table (
  friendship_id uuid, other_id uuid, handle text, name text, avatar_url text,
  location text, bio text, pronouns text, links text,
  status text, direction text, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    f.id,
    case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end,
    p.handle,
    coalesce(nullif(btrim(p.username), ''), '@' || p.handle, 'Member'),
    p.avatar_url,
    p.location,
    p.bio,
    p.pronouns,
    p.links,
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
