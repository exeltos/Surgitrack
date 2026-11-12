-- save_records_together: a group of records (a load's release, a delivery) is saved whole or not at all, with
-- the caller's rights: row security, the version check and the guards apply as to rows written one by one.
begin;
\ir ../local/fixtures.sql

update public.instrument_sets set state = 'AWAITING_RELEASE' where id = 'set-a1';
insert into public.sterilization_cycles (organization_id, id, asset_id, asset_kind, result) values
  (tests.org('A'), 'c-1', 'set-a1', 'SET', 'PASSED');

create temp table version_seen as select updated_at from public.instrument_sets where id = 'set-a1';
grant select on version_seen to authenticated;

-- What the app sends for a release of set-a1: the release, a movement, the Set made ready.
create function pg_temp.release_rows(p_release text, p_packaging boolean, p_expected timestamptz) returns jsonb
language sql as $$
  select jsonb_build_array(
    jsonb_build_object('table', 'sterilization_releases', 'row', jsonb_build_object(
      'organization_id', tests.org('A'), 'id', p_release, 'asset_id', 'set-a1', 'cycle_record_id', 'c-1',
      'decision', 'RELEASED', 'physical_parameters_ok', true, 'packaging_integrity_ok', p_packaging,
      'biological_indicator_result', 'NOT_REQUIRED')),
    jsonb_build_object('table', 'movements', 'row', jsonb_build_object(
      'organization_id', tests.org('A'), 'id', 'mv-' || p_release, 'asset', 'S000001 · Laparoscopy', 'asset_kind', 'SET',
      'from_location', 'Αποδέσμευση', 'to_location', 'Έτοιμα', 'status', 'Αποδέσμευση', 'at', '12/11/2026 10:00',
      'by_name', 'Ster A')),
    jsonb_build_object('table', 'instrument_sets', 'row', jsonb_build_object(
      'organization_id', tests.org('A'), 'id', 'set-a1', 'state', 'READY_FOR_PICKUP',
      'expected_updated_at', p_expected)))
$$;
grant execute on function pg_temp.release_rows(text, boolean, timestamptz) to authenticated;

select tests.login('ster_a');

-- One row fails (a release with damaged packaging): nothing of the group is kept.
select tests.throws($q$select public.save_records_together(pg_temp.release_rows('r-bad', false,
  (select updated_at from version_seen)))$q$, '23514', 'a group with a refused row fails as a whole');
select tests.eq(tests.count($q$select 1 from public.movements where id = 'mv-r-bad'$q$), 0, '... its movement is not kept');
select tests.eq((select state from public.instrument_sets where id = 'set-a1'), 'AWAITING_RELEASE',
  '... nor the Set''s new state');

-- Saved from an old version of the Set (another station changed it): refused, nothing kept.
select tests.throws($q$select public.save_records_together(pg_temp.release_rows('r-old', true,
  (select updated_at - interval '1 minute' from version_seen)))$q$, '40001', 'a group with a stale record fails as a whole');
select tests.eq(tests.count($q$select 1 from public.sterilization_releases where id = 'r-old'$q$), 0,
  '... its release is not kept');

-- The whole group: all of it is saved, and the new version of the Set comes back.
create temp table answer as
  select public.save_records_together(pg_temp.release_rows('r-1', true, (select updated_at from version_seen))) as saved;
select tests.eq(tests.count($q$select 1 from public.sterilization_releases where id = 'r-1'$q$), 1, 'the release is saved');
select tests.eq(tests.count($q$select 1 from public.movements where id = 'mv-r-1'$q$), 1, 'so is its movement');
select tests.eq((select state from public.instrument_sets where id = 'set-a1'), 'READY_FOR_PICKUP', 'and the Set is ready');
select tests.eq((select saved -> 0 ->> 'id' from answer), 'set-a1', 'the versioned rows come back');
select tests.ok((select (saved -> 0 ->> 'updated_at')::timestamptz = (select updated_at from public.instrument_sets where id = 'set-a1')
                   from answer), '... with their new version');
select tests.eq((select name from public.instrument_sets where id = 'set-a1'), 'Laparoscopy',
  'columns the row leaves out keep their value');
select tests.eq((select created_by from public.movements where id = 'mv-r-1'), tests.uid('ster_a'),
  'who recorded the movement is stamped by the database, as for a row written alone');

-- Sent again (a retry after a lost answer): the history rows stay as they are, no error.
select public.save_records_together(jsonb_build_array(
  (pg_temp.release_rows('r-1', true, null)) -> 0, (pg_temp.release_rows('r-1', true, null)) -> 1));
select tests.eq(tests.count($q$select 1 from public.movements where id = 'mv-r-1'$q$), 1, 'a history row sent twice is kept once');

-- A new versioned record is inserted.
select public.save_records_together(jsonb_build_array(jsonb_build_object('table', 'instruments', 'row', jsonb_build_object(
  'organization_id', tests.org('A'), 'id', 'tool-new', 'barcode', 'T000099', 'code', 'T9', 'name', 'Retractor',
  'mode', 'STOCK', 'state', 'IN_STOCK', 'uses', 0, 'sterilizations', 0))));
select tests.eq(tests.count($q$select 1 from public.instruments where id = 'tool-new'$q$), 1, 'a new record is inserted');

-- Only the hospital's record tables, and only what the caller may write.
select tests.throws($q$select public.save_records_together(jsonb_build_array(jsonb_build_object('table', 'profiles',
  'row', jsonb_build_object('organization_id', tests.org('A'), 'id', tests.uid('ster_a'), 'role', 'ADMIN'))))$q$,
  '42501', 'a table outside the record tables is refused');
select tests.throws($q$select public.save_records_together(jsonb_build_array(jsonb_build_object('table', 'hospital_settings',
  'row', jsonb_build_object('organization_id', tests.org('A'), 'id', 'state'))))$q$,
  '42501', 'so is the settings row');
select tests.throws($q$select public.save_records_together('{"table": "movements"}'::jsonb)$q$, '22023',
  'rows must be a list');
select tests.throws($q$select public.save_records_together(jsonb_build_array(jsonb_build_object('table', 'movements',
  'row', jsonb_build_object('id', 'mv-x'))))$q$, '22023', 'a row without its hospital is refused');

select tests.login('ster_b');
select tests.throws($q$select public.save_records_together(jsonb_build_array(jsonb_build_object('table', 'movements',
  'row', jsonb_build_object('organization_id', tests.org('A'), 'id', 'mv-b', 'asset', 'x', 'asset_kind', 'SET',
  'from_location', 'a', 'to_location', 'b', 'status', 'x', 'at', '12/11/2026 10:00', 'by_name', 'B'))))$q$,
  '42501', 'another hospital''s rows are refused by row security');

select tests.login('viewer_a');
select tests.throws($q$select public.save_records_together(jsonb_build_array(jsonb_build_object('table', 'movements',
  'row', jsonb_build_object('organization_id', tests.org('A'), 'id', 'mv-v', 'asset', 'x', 'asset_kind', 'SET',
  'from_location', 'a', 'to_location', 'b', 'status', 'x', 'at', '12/11/2026 10:00', 'by_name', 'V'))))$q$,
  '42501', 'a viewer writes nothing through it');

select tests.login('dept_a');
select tests.throws($q$select public.save_records_together(jsonb_build_array(jsonb_build_object('table', 'sterilization_releases',
  'row', jsonb_build_object('organization_id', tests.org('A'), 'id', 'r-dept', 'asset_id', 'set-a2', 'decision', 'REPROCESS'))))$q$,
  '42501', 'a department user cannot record a release through it either');

select tests.anon();
select tests.throws($q$select public.save_records_together('[]'::jsonb)$q$, '42501', 'signed out: not callable');

reset role;
select tests.ok(not (select prosecdef from pg_proc where proname = 'save_records_together'),
  'it runs with the caller''s rights, never its owner''s');

rollback;
