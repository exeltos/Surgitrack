-- Viewers (e.g. Nursing Directorate) read everything of their hospital and change nothing.
create or replace function public.is_viewer()
 returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce(public."current_role"() = 'VIEWER', false) $$;

create or replace function public.app_record_writable(p_collection text)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
 select case
   when public.is_platform_admin() then true
   when public.is_viewer() then false
   when p_collection = 'library' then public."current_role"() = 'ADMIN'
   when p_collection in ('movements','issues','counts','sets','tools') then public."current_role"() is not null
   else public.is_cssd_operator()
 end
$function$;

-- Viewers see the whole hospital: no department, never a supervisor.
create or replace function public.admin_profile_without_department()
 returns trigger language plpgsql set search_path to 'public'
as $function$
begin
  if new.role in ('ADMIN', 'VIEWER') then
    new.department_id := null;
  end if;
  -- Only Sterilization staff can be supervisors.
  if new.role <> 'STERILIZATION' then
    new.supervisor := false;
  end if;
  return new;
end $function$;

-- A restrictive guard on every table with row security: whatever the other policies allow,
-- a viewer cannot insert, update or delete.
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists viewer_no_insert on public.%I', t.relname);
    execute format('drop policy if exists viewer_no_update on public.%I', t.relname);
    execute format('drop policy if exists viewer_no_delete on public.%I', t.relname);
    execute format('create policy viewer_no_insert on public.%I as restrictive for insert to authenticated with check (not public.is_viewer())', t.relname);
    execute format('create policy viewer_no_update on public.%I as restrictive for update to authenticated using (not public.is_viewer())', t.relname);
    execute format('create policy viewer_no_delete on public.%I as restrictive for delete to authenticated using (not public.is_viewer())', t.relname);
  end loop;
end $$;
