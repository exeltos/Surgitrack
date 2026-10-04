-- Undoing an import is open to whoever may import into that hospital: the platform owner, and
-- inside the hospital its admin and its sterilization supervisor (can_import_assets). The checks and
-- the deletion stay in one transaction, as before. Run once from the SQL editor (it holds deletes).
create or replace function public.platform_undo_asset_import(p_org uuid, p_batch text, p_by text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_barcodes text[];
  v_ids text[];
  v_used integer;
  v_deleted integer;
begin
  if not public.can_import_assets(p_org) then raise exception 'forbidden'; end if;
  perform 1 from public.asset_imports where organization_id = p_org and id = p_batch and undone_at is null for update;
  if not found then raise exception 'import_not_found'; end if;

  perform 1 from public.instruments where organization_id = p_org and extra->>'importBatch' = p_batch for update;
  perform 1 from public.instrument_sets where organization_id = p_org and extra->>'importBatch' = p_batch for update;
  perform 1 from public.instruments t where t.organization_id = p_org and t.set_id in (
    select s.id from public.instrument_sets s where s.organization_id = p_org and s.extra->>'importBatch' = p_batch) for update;

  select coalesce(array_agg(barcode), '{}') into v_barcodes from (
    select barcode from public.instruments where organization_id = p_org and extra->>'importBatch' = p_batch
    union all
    select barcode from public.instrument_sets where organization_id = p_org and extra->>'importBatch' = p_batch) b;
  select coalesce(array_agg(id), '{}') into v_ids from (
    select id from public.instruments where organization_id = p_org and extra->>'importBatch' = p_batch
    union all
    select id from public.instrument_sets where organization_id = p_org and extra->>'importBatch' = p_batch) i;

  select
    (select count(*) from public.instruments where organization_id = p_org and extra->>'importBatch' = p_batch
       and (coalesce(uses, 0) > 0 or coalesce(sterilizations, 0) > 0 or state not in ('IN_DEPARTMENT', 'IN_STOCK')
            or (set_id is not null and set_id not in (select id from public.instrument_sets
                 where organization_id = p_org and extra->>'importBatch' = p_batch))))
  + (select count(*) from public.instrument_sets where organization_id = p_org and extra->>'importBatch' = p_batch
       and (coalesce(uses, 0) > 0 or state not in ('IN_DEPARTMENT', 'IN_STOCK')))
  + (select count(*) from public.instruments t where t.organization_id = p_org
       and t.extra->>'importBatch' is distinct from p_batch
       and t.set_id in (select id from public.instrument_sets where organization_id = p_org and extra->>'importBatch' = p_batch))
  + (select count(*) from public.movements where organization_id = p_org and split_part(asset, ' · ', 1) = any (v_barcodes))
  + (select count(*) from public.issues where organization_id = p_org and split_part(asset, ' · ', 1) = any (v_barcodes))
  + (select count(*) from public.receipts where organization_id = p_org and asset_id = any (v_ids))
  + (select count(*) from public.deliveries where organization_id = p_org and asset_id = any (v_ids))
  + (select count(*) from public.preparations where organization_id = p_org and asset_id = any (v_ids))
  + (select count(*) from public.workflow_checkpoints where organization_id = p_org and asset_id = any (v_ids))
  + (select count(*) from public.sterilization_cycles where organization_id = p_org and asset_id = any (v_ids))
  + (select count(*) from public.sterilization_releases where organization_id = p_org and asset_id = any (v_ids))
  + (select count(*) from public.surgical_counts where organization_id = p_org and set_id = any (v_ids))
  into v_used;
  if v_used > 0 then raise exception 'import_in_use:%', v_used; end if;

  delete from public.instruments where organization_id = p_org and extra->>'importBatch' = p_batch;
  get diagnostics v_deleted = row_count;
  delete from public.instrument_sets where organization_id = p_org and extra->>'importBatch' = p_batch;
  update public.asset_imports set undone_at = now(), undone_by_name = p_by where organization_id = p_org and id = p_batch;
  return v_deleted;
end $$;
revoke all on function public.platform_undo_asset_import(uuid, text, text) from public, anon;
grant execute on function public.platform_undo_asset_import(uuid, text, text) to authenticated;
