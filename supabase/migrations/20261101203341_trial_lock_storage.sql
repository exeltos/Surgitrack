-- An ended trial locks a hospital's data in every table (policy trial_lock), but the files in Storage
-- (photos of Sets, instruments and problem reports) were not covered: a locked hospital could still upload,
-- replace, delete and read them. The same rule now applies to the surgitrack-assets bucket.
drop policy if exists trial_lock_assets on storage.objects;
create policy trial_lock_assets on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'surgitrack-assets' or public.is_platform_admin() or not (select public.current_org_locked()))
  with check (bucket_id <> 'surgitrack-assets' or public.is_platform_admin() or not (select public.current_org_locked()));
