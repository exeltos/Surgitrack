-- Resetting a Demo also clears its deletion marks, so the refilled sample is not deleted again.
--
-- platform_reset_demo_organization empties the Demo; each row it deletes leaves a mark in deleted_records
-- (20261008150000_realtime_and_deleted_records.sql) for devices to drop it. The next entry refills the Demo
-- with the same ids, and a device's sync then fetched the deletions of the last minutes, dropped the refilled
-- Sets, instruments and reports from its copy, and deleted them on the server: the Demo emptied itself shortly
-- after every reset. The marks of a reset Demo describe nothing that still matters, so the reset removes them.

create or replace function public.platform_reset_demo_organization(p_org uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  delete from public.sterilization_cycles where organization_id = p_org;
  delete from public.sterilization_releases where organization_id = p_org;
  delete from public.process_loads where organization_id = p_org;
  delete from public.recall_cases where organization_id = p_org;
  delete from public.purchase_orders where organization_id = p_org;
  delete from public.recycle_bin where organization_id = p_org;
  delete from public.hospital_settings where organization_id = p_org;
  -- Last: the marks the deletions above just left, and any older ones.
  delete from public.deleted_records where organization_id = p_org;
end $function$;
