create or replace function public.platform_create_organization(p_name text,p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid;
begin
 if not public.is_platform_admin() then raise exception 'forbidden'; end if;
 insert into public.organizations(name,code,active) values(trim(p_name),upper(trim(p_code)),true) returning id into v;
 return v;
end $$;
revoke all on function public.platform_create_organization(text,text) from public;
grant execute on function public.platform_create_organization(text,text) to authenticated;

create or replace function public.platform_create_department(p_organization_id uuid,p_name text,p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid;
begin
 if not public.is_platform_admin() then raise exception 'forbidden'; end if;
 insert into public.departments(organization_id,name,code,active) values(p_organization_id,trim(p_name),upper(trim(p_code)),true) returning id into v;
 return v;
end $$;
revoke all on function public.platform_create_department(uuid,text,text) from public;
grant execute on function public.platform_create_department(uuid,text,text) to authenticated;
