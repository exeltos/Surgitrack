-- Resetting a Demo leaves no deletion marks behind, so the refilled sample is not deleted again by a device.
begin;
\ir ../local/fixtures.sql

reset role;
update public.organizations set is_demo = true where id = tests.org('B');
delete from public.deleted_records;
delete from public.instrument_sets where id = 'set-b1';
select tests.eq((select count(*)::int from public.deleted_records where organization_id = tests.org('B')), 1,
  'a deletion leaves a mark for the devices');

select tests.login('platform');
select public.platform_reset_demo_organization(tests.org('B'));
reset role;
select tests.eq((select count(*)::int from public.deleted_records where organization_id = tests.org('B')), 0,
  'the reset clears the Demo''s marks, its own and older ones');
select tests.eq((select count(*)::int from public.hospital_settings where organization_id = tests.org('B')), 0,
  'and still empties the Demo');

rollback;
