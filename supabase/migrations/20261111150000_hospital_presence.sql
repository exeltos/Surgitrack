-- Who is connected right now, as a hospital's administrators read it (the platform owner reads it for any hospital):
-- only whether and when each person was last seen, in the last minutes. The address and the browser stay the owner's
-- (platform_active_sessions); no colleague, and no one outside the hospital, gets any of it.
create or replace function public.hospital_presence(p_org uuid default null, p_minutes integer default 5)
returns table (user_id uuid, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select up.user_id, up.last_seen
    from public.user_presence up
    join public.profiles pr on pr.id = up.user_id
   where up.last_seen > now() - make_interval(mins => greatest(1, least(coalesce(p_minutes, 5), 60)))
     and pr.organization_id is not null
     and (
       (public.is_platform_admin() and (p_org is null or pr.organization_id = p_org))
       or (pr.organization_id = public.current_org_id() and public."current_role"() = 'ADMIN')
     )
$$;
revoke all on function public.hospital_presence(uuid, integer) from public, anon;
grant execute on function public.hospital_presence(uuid, integer) to authenticated;
