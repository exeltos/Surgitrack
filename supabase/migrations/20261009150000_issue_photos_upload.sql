-- Photos attached to problem reports go to Storage like the Set and instrument photos. Department users
-- report problems too, so they may now upload into their hospital's issues/ folder (and only there);
-- the Sterilization rule for the rest of the folder stays as it was. Viewers upload nothing.
alter policy surgitrack_assets_insert on storage.objects
  with check (
    bucket_id = 'surgitrack-assets'
    and (
      public.is_platform_admin()
      or ((storage.foldername(name))[1] = (public.current_org_id())::text and public.is_cssd_operator())
      or (
        (storage.foldername(name))[1] = (public.current_org_id())::text
        and (storage.foldername(name))[2] = 'issues'
        and not public.is_viewer()
      )
    )
  );
