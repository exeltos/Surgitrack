create or replace function public.platform_update_organization(p_id uuid,p_name text,p_code text,p_active boolean,p_demo_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_platform_admin() then raise exception 'forbidden'; end if;
update public.organizations set name=trim(p_name),code=upper(trim(p_code)),active=p_active,demo_enabled=p_demo_enabled,updated_at=now() where id=p_id;
end $$;
revoke all on function public.platform_update_organization(uuid,text,text,boolean,boolean) from public;
grant execute on function public.platform_update_organization(uuid,text,text,boolean,boolean) to authenticated;

create or replace function public.platform_update_department(p_id uuid,p_name text,p_code text,p_active boolean)
returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_platform_admin() then raise exception 'forbidden'; end if;
update public.departments set name=trim(p_name),code=upper(trim(p_code)),active=p_active where id=p_id;
end $$;
revoke all on function public.platform_update_department(uuid,text,text,boolean) from public;
grant execute on function public.platform_update_department(uuid,text,text,boolean) to authenticated;
