-- The mirror from instrument_sets / instruments into app_records cast NEW to both row types in one
-- statement, which Postgres rejects for whichever table fired it. Each table's row now goes through
-- jsonb into its own type, so only the matching branch is ever evaluated against the real row.
create or replace function public.mirror_instruments_to_app_records() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c text := case tg_table_name when 'instrument_sets' then 'sets' else 'tools' end;
  d jsonb;
begin
  if current_setting('surgitrack.mirroring', true) = 'on' then return null; end if;
  perform set_config('surgitrack.mirroring', 'on', true);
  if tg_op = 'DELETE' then
    delete from public.app_records where organization_id = old.organization_id and collection = c and id = old.id;
  else
    if c = 'sets' then
      d := public.instrument_set_to_record(jsonb_populate_record(null::public.instrument_sets, to_jsonb(new)));
    else
      d := public.instrument_to_record(jsonb_populate_record(null::public.instruments, to_jsonb(new)));
    end if;
    insert into public.app_records (organization_id, collection, id, data, created_at, updated_at, updated_by)
    values (new.organization_id, c, new.id, d, new.created_at, now(), new.updated_by)
    on conflict (organization_id, collection, id) do update
      set data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end if;
  perform set_config('surgitrack.mirroring', 'off', true);
  return null;
end $$;
revoke execute on function public.mirror_instruments_to_app_records() from public, anon, authenticated;
