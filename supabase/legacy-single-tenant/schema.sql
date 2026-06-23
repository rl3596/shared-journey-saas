-- Run this once in your Supabase project's SQL editor (SQL → New query → paste → Run).
-- Then add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to .env.local, restart the dev
-- server, log in, and POST /api/seed once to load the starter data.

create table if not exists timeline_events (
  id              text primary key,
  date            text not null,
  title           text not null,
  content_rui     text not null default '',
  content_wanyun  text not null default '',
  location        text not null,
  image           text
);

create table if not exists albums (
  id               text primary key,
  title            text not null,
  location         text not null,
  date             text not null,   -- start date (single-day or first day of a range)
  end_date         text,            -- optional last day of a multi-day event
  cover_image_url  text,            -- explicit cover; defaults to first photo when null
  pinned_at        timestamptz,     -- non-null = album sits in the pinned strip at top
  image_urls       text[] not null default '{}'
);

create table if not exists schedule_events (
  id     text primary key,
  owner  text not null check (owner in ('Me', 'Her', 'Joint')),
  title  text not null,
  date   text not null,  -- YYYY-MM-DD
  time   text not null,  -- HH:MM (24-hour)
  notes  text not null default ''
);

-- Privacy: enable Row Level Security with NO public policies. The app connects with
-- the service-role key (server-side only), which bypasses RLS — so the site works,
-- while anonymous/public access through the anon key is fully blocked.
alter table timeline_events enable row level security;
alter table albums          enable row level security;
alter table schedule_events enable row level security;

-- Atomic append for albums.image_urls. The gallery uploader posts photos
-- with concurrency 3; calling this RPC per photo keeps the writes race-
-- free so big batches don't lose photos to read-modify-write collisions.
create or replace function append_album_image(album_id text, new_url text)
returns void
language sql
as $$
  update albums
     set image_urls = array_append(image_urls, new_url)
   where id = album_id;
$$;
