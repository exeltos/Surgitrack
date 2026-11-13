-- Deleting a whole hospital (a real one, or a prospect's evaluation Demo) takes every record in it along.
-- Each deleted record leaves a deletion mark for the hospital's devices; while the hospital itself goes, no mark
-- is written (no device of it is left to tell, and the mark would point at a hospital that is gone).
begin;
\ir ../local/fixtures.sql

insert into public.movements (organization_id, id, asset, asset_kind, from_location, to_location, status, at, by_name)
values (tests.org('A'), 'mv-1', 'S000001 · Laparoscopy', 'SET', 'Theatre', 'Sterilization', 'Αποστολή', '13/11/2026 10:00', 'Dept A');

-- A record deleted on its own still leaves its mark.
delete from public.instrument_sets where id = 'set-a2';
select tests.eq(tests.count($q$select 1 from public.deleted_records where collection = 'sets' and id = 'set-a2'$q$), 1,
  'a Set deleted on its own leaves a deletion mark');

-- The whole hospital, with its Sets, instruments and movements: it goes, and its records with it.
delete from public.profiles where organization_id = tests.org('A');
select tests.ok(
  (select count(*) from public.organizations where id = tests.org('A')) = 1,
  'hospital A is there before');
delete from public.organizations where id = tests.org('A');
select tests.eq(tests.count($q$select 1 from public.organizations where id = tests.org('A')$q$), 0,
  'a hospital with records is deleted (it used to fail on the deletion marks)');
select tests.eq(tests.count($q$select 1 from public.instrument_sets where organization_id = tests.org('A')$q$), 0,
  '... its Sets go with it');
select tests.eq(tests.count($q$select 1 from public.movements where organization_id = tests.org('A')$q$), 0,
  '... and its movements');
select tests.eq(tests.count($q$select 1 from public.deleted_records where organization_id = tests.org('A')$q$), 0,
  '... and no deletion mark of it is left behind');
select tests.eq(tests.count($q$select 1 from public.instrument_sets where organization_id = tests.org('B')$q$), 1,
  'the other hospital keeps its Sets');

rollback;
