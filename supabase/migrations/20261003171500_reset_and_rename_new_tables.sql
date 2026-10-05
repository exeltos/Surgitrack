-- The Demo reset clears, and a department rename updates, the records in their new tables.
create or replace function public.rename_department_references() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.instrument_sets set department = new.name
     where organization_id = new.organization_id and department = old.name;
    update public.instruments set department = new.name
     where organization_id = new.organization_id and department = old.name;
    update public.issues set department = new.name
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
  delete from public.movements where organization_id = p_org;
  delete from public.issues where organization_id = p_org;
  delete from public.receipts where organization_id = p_org;
  delete from public.deliveries where organization_id = p_org;
  delete from public.preparations where organization_id = p_org;
  delete from public.surgical_counts where organization_id = p_org;
  delete from public.workflow_checkpoints where organization_id = p_org;
  delete from public.app_records where organization_id = p_org;
end $$;
