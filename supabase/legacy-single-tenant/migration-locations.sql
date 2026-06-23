-- Add geocoded coordinates to albums. Run ONCE in the Supabase SQL editor.
--
-- New albums will have these set automatically (the /api/albums route geocodes the
-- location via OpenStreetMap Nominatim before inserting). Existing albums stay NULL
-- until you re-create them or backfill manually.

alter table albums add column if not exists latitude  double precision;
alter table albums add column if not exists longitude double precision;
