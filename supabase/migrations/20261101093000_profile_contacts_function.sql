-- The sign-in email and the username (user code) of every colleague are readable by every member of a
-- hospital through the profiles table, which lets any user try passwords straight at the sign-in service
-- (bypassing the attempt limit of login-with-code) and lock a colleague's code out. This adds the way to
-- read them that will replace the table read: hospital admins get their hospital's contacts, the platform
-- owner everyone's, everybody else only their own. Nothing is taken away here; the table read is closed by
-- supabase/staged/20261101100000_hide_profile_contacts.sql, once the app uses this function.
create or replace function public.profile_contacts(p_org uuid default null)
returns table (id uuid, email text, user_code text)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.user_code
    from public.profiles p
   where (p_org is null or p.organization_id = p_org)
     and (public.is_platform_admin()
          or p.id = auth.uid()
          or (p.organization_id = public.current_org_id() and public."current_role"() = 'ADMIN'))
$$;
revoke all on function public.profile_contacts(uuid) from public, anon;
grant execute on function public.profile_contacts(uuid) to authenticated;
