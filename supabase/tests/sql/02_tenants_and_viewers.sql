-- A hospital's people see only their hospital's rows; a viewer never writes; a department user does
-- not register Sets or instruments.
begin;
\ir ../local/fixtures.sql

insert into public.deleted_records (organization_id, collection, id) values
  (tests.org('A'), 'sets', 'gone-a'), (tests.org('B'), 'sets', 'gone-b');

select tests.login('ster_a');
select tests.eq(tests.count('select * from public.instrument_sets'), 2, 'A sees its own Sets only');
select tests.eq(tests.count('select * from public.instruments where organization_id = tests.org(''B'')'), 0,
  'A sees none of B''s instruments');
select tests.eq(tests.count('select * from public.hospital_settings'), 1, 'A sees its own settings only');
select tests.eq(tests.count('select * from public.deleted_records'), 1, 'A sees its own deletions only');
select tests.eq(tests.count('select * from public.organizations'), 1, 'A sees its own hospital only');
select tests.eq(tests.rows('update public.instruments set notes = ''x'' where organization_id = tests.org(''B'')'), 0,
  'A cannot change B''s instruments');
select tests.throws($$insert into public.instruments (organization_id, id, barcode, name, mode, state)
  values (tests.org('B'), 'tool-x', 'T999999', 'X', 'STOCK', 'IN_STOCK')$$, '42501', 'A cannot add an instrument to B');

select tests.login('admin_b');
select tests.eq(tests.count('select * from public.instrument_sets'), 1, 'B sees its own Sets only');

select tests.login('viewer_a');
select tests.eq(tests.count('select * from public.instruments'), 3, 'a viewer reads the hospital''s instruments');
select tests.eq(tests.rows('update public.instruments set state = ''LOST'''), 0, 'a viewer changes nothing');
select tests.eq(tests.rows('delete from public.instruments'), 0, 'a viewer deletes nothing');
select tests.throws($$insert into public.instruments (organization_id, id, barcode, name, mode, state)
  values (tests.org('A'), 'tool-v', 'T999998', 'X', 'STOCK', 'IN_STOCK')$$, '42501', 'a viewer adds nothing');
select tests.throws($$insert into public.issues (organization_id, id, asset, type, status)
  values (tests.org('A'), 'i-v', 'x', 'x', 'OPEN')$$, '42501', 'a viewer reports no issue');

select tests.login('dept_a');
select tests.throws($$insert into public.instrument_sets (organization_id, id, barcode, name, state)
  values (tests.org('A'), 'set-d', 'S999999', 'X', 'IN_DEPARTMENT')$$, '42501', 'a department user registers no Set');
select tests.eq(tests.rows('delete from public.instruments'), 0, 'a department user deletes no instrument');
reset role;

rollback;
