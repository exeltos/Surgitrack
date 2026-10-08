-- The platform owner deletes a hospital that is no longer needed (e.g. a test hospital), with all
-- its data. Only an inactive hospital with no users left: the Studio first deletes its users (their
-- sign-in accounts go through the delete-staff function), then calls this.

create or replace function public._wipe_organization_data(p_org uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  t text;
begin
  -- Children before parents; deletions are logged to deleted_records, which goes last.
  foreach t in array array[
    'device_readings', 'devices', 'instruments', 'instrument_sets', 'movements', 'issues', 'receipts',
    'deliveries', 'preparations', 'surgical_counts', 'workflow_checkpoints', 'sterilization_cycles',
    'sterilization_releases', 'process_loads', 'recall_cases', 'purchase_orders', 'recycle_bin',
    'asset_imports', 'hospital_settings', 'signup_links', 'staff_access_requests', 'user_invitations',
    'departments', 'deleted_records'
  ] loop
    execute format('delete from public.%I where organization_id = $1', t) using p_org;
  end loop;
end
$$;

revoke all on function public._wipe_organization_data(uuid) from public, anon, authenticated;

create or replace function public.platform_delete_organization(p_org uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  copy_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.organizations where id = p_org and not is_demo) then
    raise exception 'hospital not found';
  end if;
  if exists (select 1 from public.organizations where id = p_org and active) then
    raise exception 'hospital_active';
  end if;
  if exists (select 1 from public.profiles where organization_id = p_org) then
    raise exception 'hospital_has_users';
  end if;
  -- Its private demo copy goes with it.
  for copy_id in select id from public.organizations where demo_of = p_org loop
    perform public._wipe_organization_data(copy_id);
    delete from public.organizations where id = copy_id;
  end loop;
  perform public._wipe_organization_data(p_org);
  delete from public.organizations where id = p_org;
end
$$;

revoke all on function public.platform_delete_organization(uuid) from public, anon;
grant execute on function public.platform_delete_organization(uuid) to authenticated;
