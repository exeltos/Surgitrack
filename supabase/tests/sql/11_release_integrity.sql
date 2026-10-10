-- A release that says RELEASED needs acceptable parameters, intact packaging and no failed biological
-- indicator; a Set or standalone instrument that goes straight from a sterilization stage to ready is logged,
-- and the nightly integrity checks name those with no release of a passed cycle.
begin;
\ir ../local/fixtures.sql
\set checks `sed 's/;[[:space:]]*$//' "$SURGITRACK_REPO/supabase/integrity.sql"`
create temp view found as :checks;

-- Without a signed-in user (imports, restores, the service role) nothing is logged.
update public.instrument_sets set state = 'AWAITING_RELEASE' where id in ('set-a1', 'set-a2', 'set-b1');
update public.instruments set state = 'AWAITING_RELEASE' where id = 'tool-a3';
update public.instrument_sets set state = 'READY_FOR_PICKUP' where id = 'set-b1';
select tests.eq((select count(*)::int from public.release_transitions), 0, 'a change with no signed-in user is not logged');

select tests.login('ster_a');
select tests.throws($q$insert into public.sterilization_releases (organization_id, id, asset_id, decision,
  physical_parameters_ok, packaging_integrity_ok, biological_indicator_result) values
  ((select organization_id from public.profiles where id = auth.uid()), 'r-bad', 'set-a1', 'RELEASED', true, false, 'PASS')$q$,
  '23514', 'a release with damaged packaging is refused');
select tests.throws($q$insert into public.sterilization_releases (organization_id, id, asset_id, decision,
  physical_parameters_ok, packaging_integrity_ok, biological_indicator_result) values
  ((select organization_id from public.profiles where id = auth.uid()), 'r-bad', 'set-a1', 'RELEASED', true, true, 'FAIL')$q$,
  '23514', 'so is one with a failed biological indicator');
select tests.throws($q$insert into public.sterilization_releases (organization_id, id, asset_id, decision,
  packaging_integrity_ok) values
  ((select organization_id from public.profiles where id = auth.uid()), 'r-bad', 'set-a1', 'RELEASED', true)$q$,
  '23514', 'and one that does not say the cycle parameters were acceptable');
select tests.eq(tests.rows($q$insert into public.sterilization_releases (organization_id, id, asset_id, decision,
  physical_parameters_ok, packaging_integrity_ok, biological_indicator_result) values
  ((select organization_id from public.profiles where id = auth.uid()), 'r-again', 'set-a2', 'REPROCESS', false, false, 'FAIL')$q$),
  1, 'a decision to reprocess is recorded whatever the checks say');

-- set-a1 released after a passed cycle; set-a2 and tool-a3 made ready with no release.
insert into public.sterilization_cycles (organization_id, id, asset_id, asset_kind, result) values
  (tests.org('A'), 'c-1', 'set-a1', 'SET', 'PASSED');
insert into public.sterilization_releases (organization_id, id, asset_id, cycle_record_id, decision,
  physical_parameters_ok, packaging_integrity_ok, biological_indicator_result) values
  (tests.org('A'), 'r-1', 'set-a1', 'c-1', 'RELEASED', true, true, 'NOT_REQUIRED');
update public.instrument_sets set state = 'READY_FOR_PICKUP' where id in ('set-a1', 'set-a2');
update public.instruments set state = 'READY_FOR_PICKUP' where id = 'tool-a3';
update public.instruments set state = 'READY_FOR_PICKUP' where id = 'tool-a1';
update public.instrument_sets set state = 'IN_STORAGE' where id = 'set-a1';
select tests.throws('select * from public.release_transitions', '42501', 'a hospital user cannot read the log');

reset role;
select set_config('request.jwt.claims', '', true);
select tests.eq((select string_agg(asset_id || ' ' || from_state || '>' || to_state, ', ' order by asset_id)
                   from public.release_transitions),
  'set-a1 AWAITING_RELEASE>READY_FOR_PICKUP, set-a2 AWAITING_RELEASE>READY_FOR_PICKUP, tool-a3 AWAITING_RELEASE>READY_FOR_PICKUP',
  'ready straight from a stage is logged; a Set member and a move between ready states are not');
select tests.ok((select bool_and(changed_by = tests.uid('ster_a')) from public.release_transitions),
  'with the user who made the change');

select tests.eq((select count(*)::int from found), 0, 'a change less than 12 hours old is not blamed yet');
update public.release_transitions set changed_at = changed_at - interval '1 day';
update public.sterilization_releases set created_at = created_at - interval '1 day';
select tests.eq((select n from found where hospital = 'Hospital A' and check_name = 'ready without a passed release'),
  2, 'the Set and the instrument made ready with no release are named');
update public.sterilization_cycles set result = 'FAILED' where id = 'c-1';
select tests.eq((select n from found where check_name = 'ready without a passed release'),
  3, 'a release of a failed cycle does not count');
update public.release_transitions set changed_at = changed_at - interval '3 days';
select tests.eq((select count(*)::int from found), 0, 'a change already looked at by two nightly runs is not named again');

rollback;
