create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path=public
as $$
begin
  if lower(new.email) = 'info@exeltos.com' then
    insert into public.profiles(id, organization_id, department_id, name, email, role, active, demo_enabled)
    values(new.id, null, null, 'Platform Admin', lower(new.email), 'ADMIN', true, false)
    on conflict(id) do update set name=excluded.name,email=excluded.email,role='ADMIN',active=true,organization_id=null,department_id=null;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.claim_platform_admin()
returns public.profiles
language plpgsql
security definer set search_path=public
as $$
declare p public.profiles;
begin
 if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> 'info@exeltos.com' then
   raise exception 'Not authorized';
 end if;
 insert into public.profiles(id,organization_id,department_id,name,email,role,active,demo_enabled)
 values(auth.uid(),null,null,'Platform Admin','info@exeltos.com','ADMIN',true,false)
 on conflict(id) do update set name='Platform Admin',email='info@exeltos.com',role='ADMIN',active=true,organization_id=null,department_id=null
 returning * into p;
 return p;
end $$;
grant execute on function public.claim_platform_admin() to authenticated;
