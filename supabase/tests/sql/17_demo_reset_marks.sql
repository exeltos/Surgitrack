-- A record created again loses its deletion mark; one deleted for good keeps it.
begin;
\ir ../local/fixtures.sql

reset role;
delete from public.deleted_records;
delete from public.instrument_sets where id in ('set-a1', 'set-a2');
select tests.eq((select count(*)::int from public.deleted_records where organization_id = tests.org('A')), 2,
  'each deletion leaves a mark for the devices');

insert into public.instrument_sets (organization_id, id, barcode, code, name, department, state, expected, actual)
  values (tests.org('A'), 'set-a1', 'S000001', 'LAP', 'Laparoscopy', 'Theatre', 'IN_DEPARTMENT', 0, 0);
select tests.eq((select array_agg(id) from public.deleted_records where organization_id = tests.org('A')),
  array['set-a2'], 'the Set created again (as a Demo refill does) is no longer marked deleted; the other still is');

rollback;
