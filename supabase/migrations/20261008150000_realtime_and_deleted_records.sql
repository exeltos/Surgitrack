-- S1 + S2. Devices learn about changes as they happen, and about deletions without downloading every id.
--  * deleted_records: one row per deleted record (written by the database, read by the hospital's devices).
--  * The synced tables and deleted_records are published to Supabase Realtime. Row-level rules apply to
--    what each subscriber receives, so a device hears only about its own hospital.

create table if not exists public.deleted_records (
  seq bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  collection text not null,
  id text not null,
  deleted_at timestamptz not null default now()
);
create index if not exists deleted_records_org_time_idx on public.deleted_records (organization_id, deleted_at);
alter table public.deleted_records enable row level security;
create policy deleted_records_read on public.deleted_records for select
  using ((organization_id = (SELECT current_org_id())) OR (SELECT is_platform_admin()));
revoke insert, update, delete on public.deleted_records from anon, authenticated;

create or replace function public.record_deletion() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.deleted_records (organization_id, collection, id) values (old.organization_id, tg_argv[0], old.id);
  return old;
end $fn$;
revoke execute on function public.record_deletion() from public, anon, authenticated;

create trigger instrument_sets_record_deletion after delete on public.instrument_sets for each row execute function public.record_deletion('sets');
create trigger instruments_record_deletion after delete on public.instruments for each row execute function public.record_deletion('tools');
create trigger movements_record_deletion after delete on public.movements for each row execute function public.record_deletion('movements');
create trigger issues_record_deletion after delete on public.issues for each row execute function public.record_deletion('issues');
create trigger surgical_counts_record_deletion after delete on public.surgical_counts for each row execute function public.record_deletion('counts');
create trigger receipts_record_deletion after delete on public.receipts for each row execute function public.record_deletion('receipts');
create trigger preparations_record_deletion after delete on public.preparations for each row execute function public.record_deletion('preparations');
create trigger sterilization_cycles_record_deletion after delete on public.sterilization_cycles for each row execute function public.record_deletion('sterilizationCycles');
create trigger process_loads_record_deletion after delete on public.process_loads for each row execute function public.record_deletion('processLoads');
create trigger recall_cases_record_deletion after delete on public.recall_cases for each row execute function public.record_deletion('recallCases');
create trigger sterilization_releases_record_deletion after delete on public.sterilization_releases for each row execute function public.record_deletion('sterilizationReleases');
create trigger workflow_checkpoints_record_deletion after delete on public.workflow_checkpoints for each row execute function public.record_deletion('workflowCheckpoints');
create trigger deliveries_record_deletion after delete on public.deliveries for each row execute function public.record_deletion('deliveries');
create trigger purchase_orders_record_deletion after delete on public.purchase_orders for each row execute function public.record_deletion('purchaseOrders');
create trigger recycle_bin_record_deletion after delete on public.recycle_bin for each row execute function public.record_deletion('recycleBin');

alter publication supabase_realtime add table
  public.instrument_sets, public.instruments, public.movements, public.issues, public.surgical_counts,
  public.receipts, public.preparations, public.sterilization_cycles, public.process_loads, public.recall_cases,
  public.sterilization_releases, public.workflow_checkpoints, public.deliveries, public.purchase_orders,
  public.recycle_bin, public.hospital_settings, public.deleted_records;
