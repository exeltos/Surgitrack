-- demo_seats_left(p_org) ran with its owner's rights and had no caller check, so any signed-in person who knew a
-- Demo hospital's id could read how many seats it has left. It now answers only for the caller's own hospital, for
-- the platform owner, and for the service role (invite-staff); anyone else gets null, the same as for a hospital
-- that is not an evaluation Demo, so the answer does not even show whether the id exists.
-- The grants are unchanged (authenticated and service_role).
create or replace function public.demo_seats_left(p_org uuid) returns int
language sql stable security definer set search_path = public as $$
  select d.max_extra_users
       - (select count(*) from public.profiles p
           where p.organization_id = p_org and p.id is distinct from d.evaluator_id)::int
       - (select count(*) from public.staff_access_requests r
           where r.organization_id = p_org and r.status = 'PENDING_EMAIL' and r.user_id is null)::int
    from public.demo_accounts d
   where d.organization_id = p_org
     and (auth.role() = 'service_role'
          or public.is_platform_admin()
          or p_org = public.current_org_id())
$$;
