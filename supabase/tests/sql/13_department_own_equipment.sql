-- A department user changes only their own department's equipment (an update to another department's is kept
-- without effect), and a movement always names the signed-in user who wrote it.
begin;
\ir ../local/fixtures.sql

-- ICU's Set and standalone instrument, in the same hospital as dept_a (Theatre).
insert into public.instrument_sets (organization_id, id, barcode, name, department, state, expected, actual)
  values (tests.org('A'), 'set-icu', 'S000900', 'ICU Set', 'ICU', 'IN_DEPARTMENT', 2, 2);
insert into public.instruments (organization_id, id, barcode, name, department, mode, state, max_uses, uses)
  values (tests.org('A'), 'tool-icu', 'T000900', 'ICU scissors', 'ICU', 'STANDALONE', 'IN_DEPARTMENT', 10, 3);

select tests.login('dept_a');
-- Their own Set: dispatched as before.
select tests.eq(tests.rows($$update public.instrument_sets set state = 'PENDING_STERILIZATION', patient_code = 'PT-1'
  where id = 'set-a1'$$), 1, 'a department user dispatches their own Set');
reset role;
select tests.eq((select state || '|' || patient_code from public.instrument_sets where id = 'set-a1'),
  'PENDING_STERILIZATION|PT-1', '... and it is saved');

select tests.login('dept_a');
-- Another department's: the update goes through (a batch sync is not refused) but nothing changes.
select tests.eq(tests.rows($$update public.instrument_sets set state = 'PENDING_STERILIZATION', patient_code = 'PT-2',
  uses = 1, actual = 1 where id = 'set-icu'$$), 1, 'an update to another department''s Set is accepted…');
select tests.eq(tests.rows($$update public.instruments set state = 'PENDING_STERILIZATION', uses = 4
  where id = 'tool-icu'$$), 1, '… and to its instrument');
reset role;
select tests.eq((select state || '|' || coalesce(patient_code, '-') || '|' || coalesce(uses, 0) || '|' || actual
  from public.instrument_sets where id = 'set-icu'), 'IN_DEPARTMENT|-|0|2', '… but the Set keeps every value');
select tests.eq((select state || '|' || uses from public.instruments where id = 'tool-icu'), 'IN_DEPARTMENT|3',
  '… and so does the instrument');

-- Sterilization still works on every department's equipment.
select tests.login('ster_a');
select tests.eq(tests.rows($$update public.instrument_sets set state = 'IN_WASHING' where id = 'set-icu'$$), 1,
  'Sterilization updates any department''s Set');
reset role;
select tests.eq((select state from public.instrument_sets where id = 'set-icu'), 'IN_WASHING', '... and it is saved');

-- A movement names who wrote it, whatever the device sends.
select tests.login('dept_a');
select tests.eq(tests.rows(format($q$insert into public.movements (organization_id, id, asset, asset_kind, from_location, to_location,
  status, at, by_name, created_by) values (%L, 'mv-x', 'S000900 · ICU Set', 'SET', 'ICU', 'Αποστείρωση', 'x', '11/10/2026 10:00',
  'Someone else', %L)$q$, tests.org('A'), tests.uid('admin_a'))), 1, 'a department user writes a movement');
reset role;
select tests.eq((select created_by from public.movements where id = 'mv-x'), tests.uid('dept_a'),
  '... saved as written by them, not by whom it claims');

rollback;
