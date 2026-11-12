-- Records that belong together are saved in one transaction: all of them or none.
--
-- A release of a load writes a release record per item, a movement per item, the load and each Set or
-- instrument made ready (and closes recall items); a delivery writes the delivery records, movements and the
-- Sets' and instruments' new state. Saved table by table, a dropped connection could leave half of it on the
-- server: a release recorded with its Sets still waiting, or a Set ready with no movement. The app now sends
-- such a group here, and the database keeps either all of it or nothing.
--
-- It runs with the caller's rights (security invoker): row security, the version check (40001), the
-- supervisor and department guards, the release checks and the stamps of who recorded what all apply exactly
-- as they do to the same rows written one by one. It only saves rows of the hospital's record tables; the
-- settings row and anything else are refused.
--
-- p_rows: [{"table": "<record table>", "row": {<column>: <value>, ...}}, ...], saved in the order given.
-- A row of a table with updated_at is an update when it exists (the guards see it as one), else an insert;
-- a row of a history table (no updated_at) is inserted once, and left as it is when already there.
-- Returns [{"table", "id", "updated_at"}] for the rows of tables with updated_at: their new versions.

create or replace function public.save_records_together(p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  allowed constant text[] := array[
    'instrument_sets', 'instruments', 'movements', 'issues', 'receipts', 'deliveries', 'preparations',
    'surgical_counts', 'workflow_checkpoints', 'sterilization_cycles', 'sterilization_releases',
    'process_loads', 'recall_cases', 'purchase_orders', 'recycle_bin'];
  item jsonb;
  tbl text;
  rel regclass;
  rec jsonb;
  cols text;
  set_cols text;
  versioned boolean;
  stamp timestamptz;
  touched integer;
  saved jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'save_records_together: rows must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'save_records_together: at most 2000 rows at once' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_rows) loop
    tbl := item ->> 'table';
    rec := item -> 'row';
    if tbl is null or not (tbl = any (allowed)) then
      raise exception 'save_records_together: table % is not saved here', coalesce(tbl, '(none)') using errcode = '42501';
    end if;
    if jsonb_typeof(rec) is distinct from 'object' or rec ->> 'id' is null or rec ->> 'organization_id' is null then
      raise exception 'save_records_together: a row of % without id or hospital', tbl using errcode = '22023';
    end if;
    rel := format('public.%I', tbl)::regclass;

    -- The columns the row names (and the table has); every other column keeps its value or default.
    select string_agg(format('%I', a.attname), ', ' order by a.attnum),
           string_agg(format('%I', a.attname), ', ' order by a.attnum)
             filter (where a.attname not in ('organization_id', 'id'))
      into cols, set_cols
      from pg_attribute a
     where a.attrelid = rel and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
       and rec ? a.attname::text;
    select exists (select 1 from pg_attribute a
                    where a.attrelid = rel and a.attname = 'updated_at' and a.attnum > 0 and not a.attisdropped)
      into versioned;

    if versioned then
      touched := 0;
      if set_cols is not null then
        execute format(
          'update %s t set (%s) = (select %s from jsonb_populate_record(null::%s, $1) r)
            where (t.organization_id, t.id) = (select r.organization_id, r.id from jsonb_populate_record(null::%s, $1) r)
            returning t.updated_at',
          rel, set_cols, set_cols, rel, rel)
          into stamp using rec;
        get diagnostics touched = row_count;
      end if;
      if touched = 0 then
        execute format('insert into %s (%s) select %s from jsonb_populate_record(null::%s, $1) r returning updated_at',
                       rel, cols, cols, rel)
          into stamp using rec;
      end if;
      saved := saved || jsonb_build_object('table', tbl, 'id', rec ->> 'id', 'updated_at', stamp);
    else
      execute format(
        'insert into %s (%s) select %s from jsonb_populate_record(null::%s, $1) r on conflict (organization_id, id) do nothing',
        rel, cols, cols, rel)
        using rec;
    end if;
  end loop;
  return saved;
end
$fn$;

revoke all on function public.save_records_together(jsonb) from public, anon;
grant execute on function public.save_records_together(jsonb) to authenticated, service_role;
