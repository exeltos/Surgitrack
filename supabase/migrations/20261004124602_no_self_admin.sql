-- A hospital admin manages the other users of the hospital, never their own account: another admin
-- (or the platform owner) changes or deletes it. The staff functions refuse it too; this keeps a
-- direct write to the table from doing it. Functions that update a profile on the user's behalf
-- (accepting an invitation, the staff functions) run with the owner's rights and are not affected.
alter policy profiles_update on public.profiles
  using (is_platform_admin() or (organization_id = current_org_id() and "current_role"() = 'ADMIN'::surgi_role and id <> (select auth.uid())))
  with check (is_platform_admin() or (organization_id = current_org_id() and "current_role"() = 'ADMIN'::surgi_role and id <> (select auth.uid())));

alter policy profiles_delete on public.profiles
  using (is_platform_admin() or (organization_id = current_org_id() and "current_role"() = 'ADMIN'::surgi_role and id <> (select auth.uid())));
