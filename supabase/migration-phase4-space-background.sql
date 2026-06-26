-- ============================================================================
-- Phase 4 — Per-space background image  ·  "Remember"
-- ============================================================================
-- Run ONCE in the Supabase SQL editor. Idempotent, non-breaking.
--
-- Each space can have its own background picture, shared by everyone in the
-- space, set by the space OWNER in Settings → Space Management. NULL means
-- "use the default sunset gradient". The image lives in Storage; this column
-- holds its public URL.
-- ============================================================================

alter table public.spaces
  add column if not exists background_url text;

-- Owner-only enforcement at the DB level: members may still edit a space's
-- name/anniversary (existing behaviour), but only the owner may change the
-- background. (RLS is row-level, so we gate the specific column with a trigger.)
create or replace function public.enforce_space_background_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Restrict only IN-APP users: a logged-in non-owner can't change the
  -- background. Backend/admin contexts (SQL editor, service-role) have a NULL
  -- auth.uid() and are trusted, so they pass through.
  if new.background_url is distinct from old.background_url
     and auth.uid() is not null
     and not public.is_space_owner(new.id, auth.uid()) then
    raise exception 'Only the space owner can change the background';
  end if;
  return new;
end;
$$;

drop trigger if exists spaces_background_owner_only on public.spaces;
create trigger spaces_background_owner_only
  before update on public.spaces
  for each row execute function public.enforce_space_background_owner();
