-- Database advisor findings.
-- A signed-out visitor has no access request to read.
revoke execute on function public.my_access_request() from anon, public;
grant execute on function public.my_access_request() to authenticated;

-- Hospital admins reading invitations: the signed-in user is looked up once per query, not per row.
alter policy user_invitations_admin_select on public.user_invitations
  using (public.is_platform_admin() or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role = 'ADMIN'
      and p.organization_id = user_invitations.organization_id));

-- Foreign keys of invitations get their indexes (deleting a user or department checks them).
create index if not exists user_invitations_auth_user_idx on public.user_invitations (auth_user_id);
create index if not exists user_invitations_department_idx on public.user_invitations (department_id);
create index if not exists user_invitations_invited_by_idx on public.user_invitations (invited_by);
