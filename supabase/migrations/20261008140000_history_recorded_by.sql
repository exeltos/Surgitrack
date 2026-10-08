-- A2. Every history entry keeps the account that recorded it (created_by). The column defaulted to
-- auth.uid(), but a device could send another value; now the signed-in account always wins.
-- The History screen shows this account next to the name the device wrote.

create or replace function public.stamp_recorded_by() returns trigger
language plpgsql set search_path = public as $fn$
begin
  -- The account that records a history entry is the signed-in one, whatever the device sends.
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $fn$;

create trigger movements_recorded_by before insert on public.movements for each row execute function public.stamp_recorded_by();
create trigger receipts_recorded_by before insert on public.receipts for each row execute function public.stamp_recorded_by();
create trigger deliveries_recorded_by before insert on public.deliveries for each row execute function public.stamp_recorded_by();
create trigger preparations_recorded_by before insert on public.preparations for each row execute function public.stamp_recorded_by();
create trigger surgical_counts_recorded_by before insert on public.surgical_counts for each row execute function public.stamp_recorded_by();
create trigger workflow_checkpoints_recorded_by before insert on public.workflow_checkpoints for each row execute function public.stamp_recorded_by();
create trigger sterilization_cycles_recorded_by before insert on public.sterilization_cycles for each row execute function public.stamp_recorded_by();
create trigger sterilization_releases_recorded_by before insert on public.sterilization_releases for each row execute function public.stamp_recorded_by();
create trigger recycle_bin_recorded_by before insert on public.recycle_bin for each row execute function public.stamp_recorded_by();

revoke execute on function public.stamp_recorded_by() from public, anon, authenticated;
