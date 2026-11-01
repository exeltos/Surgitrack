-- Another hospital admin's account is changed or removed only by the platform owner. The staff functions
-- (update-staff, staff-link, delete-staff) refuse a hospital admin who targets an admin; this is the same rule
-- for a direct write to profiles through the API, which a hospital admin's policy otherwise allowed.
-- Unchanged: a hospital admin still manages everyone else in their hospital (never themselves), and may still
-- give someone the Admin role through update-staff; once that person is an admin, only the platform owner
-- changes their account. The staff functions and the security definer functions run with other rights and are
-- not limited here.
alter policy profiles_update on public.profiles
  using (
    (select is_platform_admin())
    or (organization_id = (select current_org_id())
        and (select "current_role"()) = 'ADMIN'::surgi_role
        and id <> (select auth.uid())
        and role <> 'ADMIN'::surgi_role)
  );

alter policy profiles_delete on public.profiles
  using (
    (select is_platform_admin())
    or (organization_id = (select current_org_id())
        and (select "current_role"()) = 'ADMIN'::surgi_role
        and id <> (select auth.uid())
        and role <> 'ADMIN'::surgi_role)
  );
