-- ============================================================================
-- Phase 4b — Fix: let backend/admin set a space background  ·  "Remember"
-- ============================================================================
-- Run ONCE in the Supabase SQL editor. Replaces the owner-check function so it
-- only restricts IN-APP users. Direct edits from the SQL/Table editor (or the
-- service-role key) have a NULL auth.uid() and are trusted, so they pass.
--
-- CREATE OR REPLACE updates the function body in place; the existing
-- spaces_background_owner_only trigger automatically uses the new version.
-- ============================================================================

create or replace function public.enforce_space_background_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.background_url is distinct from old.background_url
     and auth.uid() is not null
     and not public.is_space_owner(new.id, auth.uid()) then
    raise exception 'Only the space owner can change the background';
  end if;
  return new;
end;
$$;
