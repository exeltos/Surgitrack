-- A record created again is no longer deleted: its deletion mark is removed.
--
-- Each deleted row leaves a mark in deleted_records (20261008150000_realtime_and_deleted_records.sql) for the
-- hospital's devices to drop it. A Demo reset deletes the whole sample and the next entry refills it with the
-- same ids; a device's sync then fetched the deletions of the last minutes, dropped the refilled Sets,
-- instruments and reports from its copy and deleted them on the server, so the Demo emptied itself shortly
-- after every reset. Now inserting a row removes the marks of the same record: what was deleted and never came
-- back (a reset Demo's own additions included) keeps its mark, so a device still open elsewhere drops it.

create index if not exists deleted_records_record_idx on public.deleted_records (organization_id, collection, id);

create or replace function public.forget_deletion() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  delete from public.deleted_records
   where organization_id = new.organization_id and collection = tg_argv[0] and id = new.id;
  return new;
end $fn$;
revoke execute on function public.forget_deletion() from public, anon, authenticated;

create trigger instrument_sets_forget_deletion after insert on public.instrument_sets for each row execute function public.forget_deletion('sets');
create trigger instruments_forget_deletion after insert on public.instruments for each row execute function public.forget_deletion('tools');
create trigger movements_forget_deletion after insert on public.movements for each row execute function public.forget_deletion('movements');
create trigger issues_forget_deletion after insert on public.issues for each row execute function public.forget_deletion('issues');
create trigger surgical_counts_forget_deletion after insert on public.surgical_counts for each row execute function public.forget_deletion('counts');
create trigger receipts_forget_deletion after insert on public.receipts for each row execute function public.forget_deletion('receipts');
create trigger preparations_forget_deletion after insert on public.preparations for each row execute function public.forget_deletion('preparations');
create trigger sterilization_cycles_forget_deletion after insert on public.sterilization_cycles for each row execute function public.forget_deletion('sterilizationCycles');
create trigger process_loads_forget_deletion after insert on public.process_loads for each row execute function public.forget_deletion('processLoads');
create trigger recall_cases_forget_deletion after insert on public.recall_cases for each row execute function public.forget_deletion('recallCases');
create trigger sterilization_releases_forget_deletion after insert on public.sterilization_releases for each row execute function public.forget_deletion('sterilizationReleases');
create trigger workflow_checkpoints_forget_deletion after insert on public.workflow_checkpoints for each row execute function public.forget_deletion('workflowCheckpoints');
create trigger deliveries_forget_deletion after insert on public.deliveries for each row execute function public.forget_deletion('deliveries');
create trigger purchase_orders_forget_deletion after insert on public.purchase_orders for each row execute function public.forget_deletion('purchaseOrders');
create trigger recycle_bin_forget_deletion after insert on public.recycle_bin for each row execute function public.forget_deletion('recycleBin');
