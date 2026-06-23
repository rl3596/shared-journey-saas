-- Atomic append for the albums.image_urls array.
--
-- Without this, two parallel `POST /api/albums/:id/photos` requests can
-- read the same image_urls snapshot and each write back an updated copy,
-- silently losing one of the new URLs. The client uploads photos with
-- concurrency 3, so big batches lose roughly 25-30% of photos.
--
-- A single SQL `UPDATE … array_append(...)` statement is row-locked and
-- atomic, so concurrent calls serialize correctly without losing data.
--
-- Run this once in your Supabase SQL editor. Safe to re-run.

create or replace function append_album_image(album_id text, new_url text)
returns void
language sql
as $$
  update albums
     set image_urls = array_append(image_urls, new_url)
   where id = album_id;
$$;
