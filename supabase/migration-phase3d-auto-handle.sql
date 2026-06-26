-- ============================================================================
-- Phase 3d — Auto-assign a searchable handle on signup  ·  "Remember"
-- ============================================================================
-- Run ONCE in the Supabase SQL editor. Idempotent.
--
-- New users now get a real @handle automatically (derived from their email,
-- made unique), so they're immediately findable on the Friends page. They can
-- still change it on the Profile page. Existing handle-less accounts are
-- backfilled the same way.
-- ============================================================================

-- 1) Signup trigger: generate a unique, valid handle alongside the profile.
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

  -- Build a handle base from the email prefix: lowercase, only [a-z0-9_],
  -- collapse/trim underscores. Fall back to 'friend' if nothing usable remains.
  base_handle := btrim(
    regexp_replace(
      regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '_', 'g'),
      '_+', '_', 'g'
    ), '_');
  if length(base_handle) = 0 then
    base_handle := 'friend';
  end if;
  base_handle := left(base_handle, 24);  -- leave room for a numeric suffix

  -- First try the bare base; on collision (or if too short) append 4 digits and
  -- keep rolling until it's a valid (>= 3 chars) and unique handle.
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

-- 2) Backfill: give every existing handle-less account a handle the same way.
do $$
declare
  r           record;
  base_handle text;
  candidate   text;
begin
  for r in
    select p.id, u.email
      from public.profiles p
      join auth.users u on u.id = p.id
     where p.handle is null
  loop
    base_handle := btrim(
      regexp_replace(
        regexp_replace(lower(split_part(r.email, '@', 1)), '[^a-z0-9_]', '_', 'g'),
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

    update public.profiles set handle = candidate where id = r.id;
  end loop;
end $$;
