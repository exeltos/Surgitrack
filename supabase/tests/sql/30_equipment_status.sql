-- Equipment status (out of service, tests): Sterilization staff and administrators record it for their own hospital,
-- everyone in the hospital reads it, and viewers and departments never write.
begin;
\ir ../local/fixtures.sql

select tests.login('ster_a');
insert into public.equipment_status (organization_id, name, tests)
values (tests.org('A'), 'Κλίβανος 1', '[{"id":"t1","kind":"BOWIE_DICK","result":"FAIL","at":"10/11/2026 07:30","by":"Χ"}]');
select tests.eq(tests.count('select 1 from public.equipment_status'), 1, 'Sterilization staff record a test of their hospital''s sterilizer');
update public.equipment_status set out_of_service = '{"reason":"BREAKDOWN","since":"10/11/2026 08:00","by":"Χ"}'
where name = 'Κλίβανος 1';
select tests.eq(
  tests.count($q$select 1 from public.equipment_status where out_of_service->>'reason' = 'BREAKDOWN'$q$), 1,
  'and put it out of service');
select tests.throws(
  $q$insert into public.equipment_status (organization_id, name) values (tests.org('B'), 'Κλίβανος Β')$q$,
  '42501', 'but not another hospital''s');

select tests.login('admin_a');
select tests.eq(tests.count('select 1 from public.equipment_status'), 1, 'the hospital admin reads it');
update public.equipment_status set out_of_service = null where name = 'Κλίβανος 1';
select tests.eq(tests.count('select 1 from public.equipment_status where out_of_service is null'), 1, 'and may put it back in service');

select tests.login('dept_a');
select tests.eq(tests.count('select 1 from public.equipment_status'), 1, 'a department user reads it (to know what is in service)');
select tests.throws(
  $q$insert into public.equipment_status (organization_id, name) values (tests.org('A'), 'Κλίβανος 2')$q$,
  '42501', 'but writes nothing');

select tests.login('viewer_a');
select tests.throws(
  $q$insert into public.equipment_status (organization_id, name) values (tests.org('A'), 'Κλίβανος 2')$q$,
  '42501', 'a viewer writes nothing either');

select tests.login('admin_b');
select tests.eq(tests.count('select 1 from public.equipment_status'), 0, 'another hospital sees none of it');
update public.equipment_status set tests = '[]';
select tests.login('admin_a');
select tests.eq(
  tests.count($q$select 1 from public.equipment_status where jsonb_array_length(tests) = 1$q$), 1,
  'and changes none of it');

select tests.login('platform');
select tests.throws(
  $q$insert into public.equipment_status (organization_id, name, tests) values (tests.org('A'), 'Κλίβανος 3', '{}')$q$,
  '23514', 'the tests are a list');

rollback;
