create or replace function public.platform_list_departments()
returns table(id uuid,organization_id uuid,name text,code text,active boolean)
language sql security definer set search_path=public as $$
 select d.id,d.organization_id,d.name,d.code,d.active from public.departments d
 where public.is_platform_admin()
    or d.organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid() and p.active)
 order by d.name
$$;
revoke all on function public.platform_list_departments() from public;
grant execute on function public.platform_list_departments() to authenticated;
