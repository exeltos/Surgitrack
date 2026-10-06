-- A hospital's admin manages its departments and staff, but the hospital record itself
-- (name, code, active, demo access) is changed only by the platform admin.
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
