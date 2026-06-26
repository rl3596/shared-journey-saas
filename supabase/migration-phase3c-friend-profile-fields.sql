-- ============================================================================
-- Phase 3c — Friend profile fields (location + bio)  ·  "Remember"
-- ============================================================================
-- Run ONCE in the Supabase SQL editor. Adds `location` and `bio` to the
-- get_friends_overview() result so the Friends page can show a friend's mini
-- profile. (A friend isn't necessarily a co-member, so this DEFINER RPC is what
-- lets us read those fields without widening the profiles RLS policy.)
--
-- Postgres can't change a function's return columns via CREATE OR REPLACE, so
-- we DROP then recreate.
-- ============================================================================

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
