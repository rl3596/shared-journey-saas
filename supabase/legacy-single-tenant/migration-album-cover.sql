-- Explicit album cover photo.
--
-- Adds a nullable cover_image_url column to albums. Until this migration
-- runs, the gallery code falls back to image_urls[1] (the first photo);
-- after it runs, every existing row is backfilled with its first photo's
-- URL so behaviour stays identical on day one.
--
-- Run this once in your Supabase SQL editor. Safe to re-run.

alter table albums
  add column if not exists cover_image_url text;

-- Backfill: set cover to the first photo URL where it isn't already set.
update albums
   set cover_image_url = image_urls[1]
 where cover_image_url is null
   and coalesce(array_length(image_urls, 1), 0) > 0;
