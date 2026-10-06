revoke execute on function public.current_org_id() from public, anon, authenticated;
revoke execute on function public.current_role() from public, anon, authenticated;
revoke execute on function public.current_department_id() from public, anon, authenticated;
revoke execute on function public.is_platform_admin() from public, anon, authenticated;

drop policy if exists org_admin on public.organizations;
create policy org_insert on public.organizations for insert to authenticated with check (public.is_platform_admin());
create policy org_update on public.organizations for update to authenticated using (public.is_platform_admin() or (id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (id=public.current_org_id() and public.current_role()='ADMIN'));
create policy org_delete on public.organizations for delete to authenticated using (public.is_platform_admin());

drop policy if exists dept_admin on public.departments;
create policy dept_insert on public.departments for insert to authenticated with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy dept_update on public.departments for update to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy dept_delete on public.departments for delete to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

drop policy if exists profiles_admin on public.profiles;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id=(select auth.uid()) or organization_id=public.current_org_id() or public.is_platform_admin());
create policy profiles_insert on public.profiles for insert to authenticated with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy profiles_update on public.profiles for update to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

drop policy if exists rp_admin on public.role_permissions;
create policy rp_insert on public.role_permissions for insert to authenticated with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy rp_update on public.role_permissions for update to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy rp_delete on public.role_permissions for delete to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

drop policy if exists lib_admin on public.library_items;
create policy lib_insert on public.library_items for insert to authenticated with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy lib_update on public.library_items for update to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy lib_delete on public.library_items for delete to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

drop policy if exists sets_write on public.sets;
create policy sets_insert on public.sets for insert to authenticated with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy sets_update on public.sets for update to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin()) with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy sets_delete on public.sets for delete to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
drop policy if exists tools_write on public.tools;
create policy tools_insert on public.tools for insert to authenticated with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy tools_update on public.tools for update to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin()) with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy tools_delete on public.tools for delete to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());

drop policy if exists wfv_admin on public.workflow_versions;
create policy wfv_insert on public.workflow_versions for insert to authenticated with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy wfv_update on public.workflow_versions for update to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy wfv_delete on public.workflow_versions for delete to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

drop policy if exists settings_admin on public.system_settings;
create policy settings_insert on public.system_settings for insert to authenticated with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy settings_update on public.system_settings for update to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy settings_delete on public.system_settings for delete to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

create index if not exists profiles_org_idx on public.profiles(organization_id);
create index if not exists profiles_department_idx on public.profiles(department_id);
create index if not exists sets_department_idx on public.sets(department_id);
create index if not exists tools_department_idx on public.tools(department_id);
create index if not exists asset_photos_org_idx on public.asset_photos(organization_id);
create index if not exists asset_photos_created_by_idx on public.asset_photos(created_by);
create index if not exists movements_performed_by_idx on public.movements(performed_by);
create index if not exists issues_department_idx on public.issues(department_id);
create index if not exists issues_created_by_idx on public.issues(created_by);
create index if not exists workflow_versions_changed_by_idx on public.workflow_versions(changed_by);
create index if not exists process_loads_created_by_idx on public.process_loads(created_by);
create index if not exists process_load_items_org_idx on public.process_load_items(organization_id);
create index if not exists process_load_items_department_idx on public.process_load_items(department_id);
create index if not exists workflow_events_department_idx on public.workflow_events(department_id);
create index if not exists workflow_events_load_idx on public.workflow_events(load_id);
create index if not exists workflow_events_performed_by_idx on public.workflow_events(performed_by);
create index if not exists recall_cases_org_idx on public.recall_cases(organization_id);
create index if not exists recall_cases_load_idx on public.recall_cases(load_id);
create index if not exists recall_cases_opened_by_idx on public.recall_cases(opened_by);
create index if not exists recall_items_org_idx on public.recall_items(organization_id);
create index if not exists configuration_audit_org_idx on public.configuration_audit(organization_id);
create index if not exists configuration_audit_actor_idx on public.configuration_audit(actor_id);
