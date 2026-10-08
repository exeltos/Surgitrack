-- S4. Two devices changing the same record: the second save no longer silently overwrites the first.
-- A device sends the version it last saw (expected_updated_at = the record's updated_at then); when the
-- record changed since, the update is refused (40001). The device then fetches the new version, merges
-- field by field (its own changes over the new version; a field changed on both keeps the saved value)
-- and tells the user. Rows sent without a version (new records, older copies) are not checked.

alter table public.instrument_sets add column if not exists expected_updated_at timestamptz;
alter table public.instruments add column if not exists expected_updated_at timestamptz;
alter table public.issues add column if not exists expected_updated_at timestamptz;
alter table public.process_loads add column if not exists expected_updated_at timestamptz;
alter table public.recall_cases add column if not exists expected_updated_at timestamptz;
alter table public.purchase_orders add column if not exists expected_updated_at timestamptz;
alter table public.hospital_settings add column if not exists expected_updated_at timestamptz;

create or replace function public.check_expected_version() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if new.expected_updated_at is not null and old.updated_at is distinct from new.expected_updated_at then
    raise exception 'record % changed on another device', old.id using errcode = '40001';
  end if;
  new.expected_updated_at := null;
  return new;
end $fn$;
revoke execute on function public.check_expected_version() from public, anon, authenticated;

-- Named to run first among the BEFORE UPDATE triggers (alphabetical order).
create trigger instrument_sets_a_version_check before update on public.instrument_sets for each row execute function public.check_expected_version();
create trigger instruments_a_version_check before update on public.instruments for each row execute function public.check_expected_version();
create trigger issues_a_version_check before update on public.issues for each row execute function public.check_expected_version();
create trigger process_loads_a_version_check before update on public.process_loads for each row execute function public.check_expected_version();
create trigger recall_cases_a_version_check before update on public.recall_cases for each row execute function public.check_expected_version();
create trigger purchase_orders_a_version_check before update on public.purchase_orders for each row execute function public.check_expected_version();
create trigger hospital_settings_a_version_check before update on public.hospital_settings for each row execute function public.check_expected_version();
