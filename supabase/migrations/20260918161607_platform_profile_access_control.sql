create or replace function public.platform_set_profile_access(p_id uuid,p_active boolean,p_demo_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'forbidden'; end if;
 update public.profiles set active=p_active,demo_enabled=p_demo_enabled,updated_at=now()
 where id=p_id and organization_id is not null;
end $$;
revoke all on function public.platform_set_profile_access(uuid,boolean,boolean) from public;
grant execute on function public.platform_set_profile_access(uuid,boolean,boolean) to authenticated;
