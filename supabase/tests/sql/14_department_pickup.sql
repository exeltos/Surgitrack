-- The department records the pickup of sterile items brought from Sterilization: a delivery only as its receiver,
-- for its own department, and its own Set or instrument from «Έτοιμο για παραλαβή» to «Στο τμήμα».
begin;
\ir ../local/fixtures.sql

reset role;
update public.instrument_sets set state = 'READY_FOR_PICKUP', extra = '{"sterileUntil":"2027-01-01"}' where id = 'set-a1';
insert into public.instrument_sets (organization_id, id, barcode, name, department, state, expected, actual)
  values (tests.org('A'), 'set-icu', 'S000900', 'ICU Set', 'ICU', 'READY_FOR_PICKUP', 1, 1);
select tests.service();
insert into public.handover_signatures (id, organization_id, signer_id, witness_id, asset_ids) values
  ('00000000-0000-4000-8000-0000000000b1', tests.org('A'), tests.uid('ster_a'), tests.uid('dept_a'), '{set-a1}');

select tests.login('dept_a');
select tests.eq(tests.rows(format($q$insert into public.deliveries (organization_id, id, asset_id, department,
  delivered_by_user_id, received_by_user_id, extra) values (%L, 'd-pickup', 'set-a1', 'Theatre', %L, %L,
  '{"handoverSignatureId":"00000000-0000-4000-8000-0000000000b1"}')$q$,
  tests.org('A'), tests.uid('ster_a'), tests.uid('dept_a'))), 1, 'a department user records their own pickup');
select tests.throws(format($q$insert into public.deliveries (organization_id, id, asset_id, department,
  delivered_by_user_id, received_by_user_id) values (%L, 'd-for-other', 'set-a1', 'Theatre', %L, %L)$q$,
  tests.org('A'), tests.uid('ster_a'), tests.uid('sup_a')), '42501', '... but not one received by someone else');
select tests.throws(format($q$insert into public.deliveries (organization_id, id, asset_id, department,
  delivered_by_user_id, received_by_user_id) values (%L, 'd-icu', 'set-icu', 'ICU', %L, %L)$q$,
  tests.org('A'), tests.uid('ster_a'), tests.uid('dept_a')), '42501', '... nor one for another department');
select tests.throws(format($q$insert into public.deliveries (organization_id, id, asset_id, department,
  delivered_by_user_id, received_by_user_id) values (%L, 'd-b', 'set-b1', 'Theatre', %L, %L)$q$,
  tests.org('B'), tests.uid('ster_b'), tests.uid('dept_a')), '42501', '... nor one in another hospital');

-- The picked-up Set moves to the department and stays sterile; another department's does not move.
select tests.eq(tests.rows($$update public.instrument_sets set state = 'IN_DEPARTMENT' where id = 'set-a1'$$), 1,
  'a department user moves their picked-up Set to the department');
select tests.eq(tests.rows($$update public.instrument_sets set state = 'IN_DEPARTMENT' where id = 'set-icu'$$), 1,
  '... an update to another department''s is accepted');
reset role;
select tests.eq((select counterparty_verified from public.deliveries where id = 'd-pickup'), true,
  'the pickup is verified by the Sterilization person''s signature');
select tests.eq((select state || '|' || (extra->>'sterileUntil') from public.instrument_sets where id = 'set-a1'),
  'IN_DEPARTMENT|2027-01-01', '... the Set is in the department, its sterile date kept');
select tests.eq((select state from public.instrument_sets where id = 'set-icu'), 'READY_FOR_PICKUP',
  '... and the other department''s Set has not moved');

-- Nothing else opens up: a department user still cannot mark a Set ready for pickup.
reset role;
update public.instrument_sets set state = 'IN_DEPARTMENT' where id = 'set-a2';
select tests.login('dept_a');
select tests.eq(tests.rows($$update public.instrument_sets set state = 'READY_FOR_PICKUP' where id = 'set-a2'$$), 1,
  'an update to READY_FOR_PICKUP is accepted…');
reset role;
select tests.eq((select state from public.instrument_sets where id = 'set-a2'), 'IN_DEPARTMENT', '… but not saved');

rollback;
