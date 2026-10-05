-- RLS helpers only expose the caller's own org/role/department; policies need EXECUTE to evaluate them.
grant execute on function public.current_org_id() to authenticated;
grant execute on function public."current_role"() to authenticated;
grant execute on function public.current_department_id() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

-- True when the caller is a CSSD operator or org admin (never a DEPARTMENT user).
create or replace function public.is_cssd_operator() returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(public."current_role"() in ('ADMIN','STERILIZATION'), false)
$$;
revoke execute on function public.is_cssd_operator() from public, anon;
grant execute on function public.is_cssd_operator() to authenticated;

-- Sets / tools: DEPARTMENT may read and update state (dispatch) but never create or delete.
drop policy if exists sets_insert on public.sets;
drop policy if exists sets_delete on public.sets;
create policy sets_insert on public.sets for insert to authenticated
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
create policy sets_delete on public.sets for delete to authenticated
 using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
drop policy if exists tools_insert on public.tools;
drop policy if exists tools_delete on public.tools;
create policy tools_insert on public.tools for insert to authenticated
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
create policy tools_delete on public.tools for delete to authenticated
 using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));

-- Asset photos: readable by the org, managed by CSSD/admin only.
drop policy if exists photos_rw on public.asset_photos;
create policy photos_read on public.asset_photos for select to authenticated
 using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy photos_insert on public.asset_photos for insert to authenticated
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
create policy photos_update on public.asset_photos for update to authenticated
 using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()))
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
create policy photos_delete on public.asset_photos for delete to authenticated
 using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));

-- Process loads (washing/sterilization cycles): CSSD records, never deletable via the API.
drop policy if exists loads_rw on public.process_loads;
create policy loads_read on public.process_loads for select to authenticated
 using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy loads_insert on public.process_loads for insert to authenticated
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
create policy loads_update on public.process_loads for update to authenticated
 using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()))
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));

-- Load items may be removed while a load is being assembled, by CSSD/admin only.
drop policy if exists loaditems_rw on public.process_load_items;
create policy loaditems_read on public.process_load_items for select to authenticated
 using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy loaditems_insert on public.process_load_items for insert to authenticated
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
create policy loaditems_update on public.process_load_items for update to authenticated
 using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()))
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
create policy loaditems_delete on public.process_load_items for delete to authenticated
 using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));

-- Recalls: CSSD records, never deletable via the API.
drop policy if exists recalls_rw on public.recall_cases;
create policy recalls_read on public.recall_cases for select to authenticated
 using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy recalls_insert on public.recall_cases for insert to authenticated
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
create policy recalls_update on public.recall_cases for update to authenticated
 using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()))
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
drop policy if exists recallitems_rw on public.recall_items;
create policy recallitems_read on public.recall_items for select to authenticated
 using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy recallitems_insert on public.recall_items for insert to authenticated
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));
create policy recallitems_update on public.recall_items for update to authenticated
 using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()))
 with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.is_cssd_operator()));

-- Issues: any org user may report and update; only admins may delete.
drop policy if exists issues_rw on public.issues;
create policy issues_read on public.issues for select to authenticated
 using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy issues_insert on public.issues for insert to authenticated
 with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy issues_update on public.issues for update to authenticated
 using (organization_id=public.current_org_id() or public.is_platform_admin())
 with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy issues_delete on public.issues for delete to authenticated
 using (public.is_platform_admin() or (organization_id=public.current_org_id() and public."current_role"()='ADMIN'));

-- Storage bucket surgitrack-assets: objects live under "<organization_id>/...".
create policy surgitrack_assets_read on storage.objects for select to authenticated
 using (bucket_id='surgitrack-assets' and (public.is_platform_admin() or (storage.foldername(name))[1]=public.current_org_id()::text));
create policy surgitrack_assets_insert on storage.objects for insert to authenticated
 with check (bucket_id='surgitrack-assets' and (public.is_platform_admin() or ((storage.foldername(name))[1]=public.current_org_id()::text and public.is_cssd_operator())));
create policy surgitrack_assets_update on storage.objects for update to authenticated
 using (bucket_id='surgitrack-assets' and (public.is_platform_admin() or ((storage.foldername(name))[1]=public.current_org_id()::text and public.is_cssd_operator())))
 with check (bucket_id='surgitrack-assets' and (public.is_platform_admin() or ((storage.foldername(name))[1]=public.current_org_id()::text and public.is_cssd_operator())));
create policy surgitrack_assets_delete on storage.objects for delete to authenticated
 using (bucket_id='surgitrack-assets' and (public.is_platform_admin() or ((storage.foldername(name))[1]=public.current_org_id()::text and public.is_cssd_operator())));
