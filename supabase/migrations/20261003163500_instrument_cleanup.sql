-- Phase 1 cleanup: Sets and instruments live only in instrument_sets / instruments now.
-- Removes the transition mirror and the duplicate rows in app_records, and app_records stops
-- accepting Sets and instruments (a browser still on the old version gets an error, not a silent copy).

-- 1. The mirror between app_records and the new tables.
drop trigger if exists app_records_mirror_instruments on public.app_records;
drop trigger if exists instrument_sets_mirror_app_records on public.instrument_sets;
drop trigger if exists instruments_mirror_app_records on public.instruments;
drop function if exists public.mirror_app_records_instruments();
drop function if exists public.mirror_instruments_to_app_records();
-- The record <-> row helpers were only needed for the copy and the mirror.
drop function if exists public.instrument_set_from_record(uuid, text, jsonb, timestamptz);
drop function if exists public.instrument_from_record(uuid, text, jsonb, timestamptz);
drop function if exists public.instrument_set_to_record(public.instrument_sets);
drop function if exists public.instrument_to_record(public.instruments);
drop function if exists public.jsonb_text_array(jsonb);

-- 2. The duplicate copies.
delete from public.app_records where collection in ('sets', 'tools');

-- 3. app_records no longer takes Sets or instruments.
drop policy if exists app_records_insert on public.app_records;
create policy app_records_insert on public.app_records for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable(collection) and collection not in ('sets', 'tools'));
drop policy if exists app_records_update on public.app_records;
create policy app_records_update on public.app_records for update to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin())
    and collection in ('library', 'issues', 'processLoads', 'recallCases') and public.app_record_writable(collection))
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and collection in ('library', 'issues', 'processLoads', 'recallCases') and public.app_record_writable(collection));
drop policy if exists app_records_delete on public.app_records;
create policy app_records_delete on public.app_records for delete to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin())
    and collection = 'issues' and (public."current_role"() = 'ADMIN' or public.is_platform_admin()));

-- 4. Department renames and the Demo reset without the mirror switch.
create or replace function public.rename_department_references() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.app_records
       set data = jsonb_set(data, '{department}', to_jsonb(new.name)), updated_at = now()
     where organization_id = new.organization_id and collection = 'issues' and data->>'department' = old.name;
    update public.instrument_sets set department = new.name
     where organization_id = new.organization_id and department = old.name;
    update public.instruments set department = new.name
     where organization_id = new.organization_id and department = old.name;
  end if;
  return new;
end $$;

create or replace function public.platform_reset_demo_organization(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.organizations where id = p_org and is_demo) then
    raise exception 'not a demo organization';
  end if;
  delete from public.instruments where organization_id = p_org;
  delete from public.instrument_sets where organization_id = p_org;
  delete from public.app_records where organization_id = p_org;
end $$;
