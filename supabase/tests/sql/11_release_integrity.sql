-- A release that says RELEASED needs acceptable parameters, intact packaging and no failed biological
-- indicator. A Set or standalone instrument goes straight from a sterilization stage to ready only with an
-- unused release of a passed cycle of it, which is recorded; the nightly integrity checks name changes logged
-- before that rule with no such release.
begin;
\ir ../local/fixtures.sql
\set checks `sed 's/;[[:space:]]*$//' "$SURGITRACK_REPO/supabase/integrity.sql"`
create temp view found as :checks;

-- Without a signed-in user (imports, restores, the service role) nothing is checked or logged.
update public.instrument_sets set state = 'AWAITING_RELEASE' where id in ('set-a1', 'set-a2', 'set-b1');
update public.instruments set state = 'AWAITING_RELEASE' where id = 'tool-a3';
update public.instrument_sets set state = 'READY_FOR_PICKUP' where id = 'set-b1';
select tests.eq((select state from public.instrument_sets where id = 'set-b1'), 'READY_FOR_PICKUP',
  'a change with no signed-in user is not checked');
select tests.eq((select count(*)::int from public.release_transitions), 0, 'nor logged');

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

-- set-a1: a passed cycle, released. set-a2: only a REPROCESS decision, and a release of a failed cycle.
insert into public.sterilization_cycles (organization_id, id, asset_id, asset_kind, result) values
  (tests.org('A'), 'c-1', 'set-a1', 'SET', 'PASSED'),
  (tests.org('A'), 'c-2', 'set-a2', 'SET', 'FAILED');
insert into public.sterilization_releases (organization_id, id, asset_id, cycle_record_id, decision,
  physical_parameters_ok, packaging_integrity_ok, biological_indicator_result) values
  (tests.org('A'), 'r-1', 'set-a1', 'c-1', 'RELEASED', true, true, 'NOT_REQUIRED'),
  (tests.org('A'), 'r-2', 'set-a2', 'c-2', 'RELEASED', true, true, 'NOT_REQUIRED');

select tests.throws($q$update public.instrument_sets set state = 'READY_FOR_PICKUP' where id = 'set-a2'$q$,
  '23514', 'a Set is not made ready with no release of a passed cycle');
select tests.throws($q$update public.instruments set state = 'IN_STORAGE' where id = 'tool-a3'$q$,
  '23514', 'nor a standalone instrument with no release at all');
select tests.eq(tests.rows($q$update public.instrument_sets set state = 'READY_FOR_PICKUP' where id = 'set-a1'$q$),
  1, 'a Set released after a passed cycle is made ready');
select tests.eq(tests.rows($q$update public.instruments set state = 'READY_FOR_PICKUP' where id = 'tool-a1'$q$),
  1, 'its instruments follow it');
select tests.eq(tests.rows($q$update public.instrument_sets set state = 'IN_STORAGE' where id = 'set-a1'$q$),
  1, 'moving between ready states needs nothing more');
update public.instrument_sets set state = 'AWAITING_RELEASE' where id = 'set-a1';
select tests.throws($q$update public.instrument_sets set state = 'READY_FOR_PICKUP' where id = 'set-a1'$q$,
  '23514', 'a release makes its Set ready only once');
select tests.throws('select * from public.release_transitions', '42501', 'a hospital user cannot read the log');

reset role;
select set_config('request.jwt.claims', '', true);
select tests.eq((select string_agg(asset_id || ' ' || from_state || '>' || to_state || ' ' || release_id, ', ')
                   from public.release_transitions),
  'set-a1 AWAITING_RELEASE>READY_FOR_PICKUP r-1', 'the change is logged with the release it used');
select tests.ok((select bool_and(changed_by = tests.uid('ster_a')) from public.release_transitions),
  'and the user who made it');

-- Changes logged before the rule (no release recorded): named when no release of a passed cycle is near.
update public.release_transitions set changed_at = changed_at - interval '1 day';
insert into public.release_transitions (organization_id, asset_kind, asset_id, from_state, to_state, changed_at) values
  (tests.org('A'), 'SET', 'set-a2', 'AWAITING_RELEASE', 'READY_FOR_PICKUP', now() - interval '1 day'),
  (tests.org('A'), 'TOOL', 'tool-a3', 'AWAITING_RELEASE', 'READY_FOR_PICKUP', now() - interval '1 hour');
update public.sterilization_releases set created_at = created_at - interval '1 day';
select tests.eq((select string_agg(hospital || ': ' || check_name || ' ' || n, ', ') from found),
  'Hospital A: ready without a passed release 1',
  'an old change with no release of a passed cycle is named; a recent one and a recorded release are not');
update public.release_transitions set changed_at = changed_at - interval '3 days';
select tests.eq((select count(*)::int from found), 0, 'a change already looked at by two nightly runs is not named again');

rollback;
