-- Resetting the demo hospital also empties its bin (holds deletes: run from the SQL editor).
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
end $function$;
