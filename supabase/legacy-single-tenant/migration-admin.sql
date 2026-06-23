-- Admin-features migration. Run ONCE in the Supabase SQL editor (after schema.sql).

-- 1) Storage bucket for uploaded photos and timeline cover images.
--    public = true so images load by URL in the browser. All writes/deletes go through
--    the app's server using the service-role key (which bypasses RLS), so no extra
--    storage policies are needed.
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;

-- 2) Rename schedule owners: Me -> Rui, Her -> Wanyun (Joint unchanged).
--    Order matters: drop the old CHECK before updating rows to the new values.
alter table schedule_events drop constraint if exists schedule_events_owner_check;

update schedule_events set owner = 'Rui'    where owner = 'Me';
update schedule_events set owner = 'Wanyun' where owner = 'Her';

alter table schedule_events
  add constraint schedule_events_owner_check check (owner in ('Rui', 'Wanyun', 'Joint'));
