-- A release that says RELEASED needs acceptable parameters, intact packaging and no failed biological
-- indicator; a Set or standalone instrument goes straight from a sterilization stage to ready only with an
-- unused release of a passed cycle, and the nightly integrity checks name a logged change with none.
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
select tests.eq((select count(*)::int from public.release_transitions), 0, '... nor logged');

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

-- Ready with no release, or with one that does not release it, is refused.
select tests.throws($q$update public.instruments set state = 'READY_FOR_PICKUP' where id = 'tool-a3'$q$,
  '23514', 'an instrument is not made ready with no release');
select tests.throws($q$update public.instrument_sets set state = 'READY_FOR_PICKUP' where id = 'set-a2'$q$,
  '23514', 'nor a Set whose release says reprocess');
insert into public.sterilization_cycles (organization_id, id, asset_id, asset_kind, result) values
  (tests.org('A'), 'c-0', 'set-a1', 'SET', 'FAILED');
insert into public.sterilization_releases (organization_id, id, asset_id, asset_kind, cycle_record_id, decision,
  physical_parameters_ok, packaging_integrity_ok, biological_indicator_result, created_at) values
  (tests.org('A'), 'r-0', 'set-a1', 'SET', 'c-0', 'RELEASED', true, true, 'NOT_REQUIRED', now() - interval '1 hour');
select tests.throws($q$update public.instrument_sets set state = 'IN_STORAGE' where id = 'set-a1'$q$,
  '23514', 'nor one released after a failed cycle');
insert into public.sterilization_releases (organization_id, id, asset_id, asset_kind, decision,
  physical_parameters_ok, packaging_integrity_ok, biological_indicator_result, created_at) values
  (tests.org('A'), 'r-00', 'set-a1', 'SET', 'RELEASED', true, true, 'NOT_REQUIRED', now() - interval '30 minutes');
select tests.throws($q$update public.instrument_sets set state = 'IN_STORAGE' where id = 'set-a1'$q$,
  '23514', 'nor one released with no cycle on record');

-- Released after a passed cycle: ready, and the release is used.
insert into public.sterilization_cycles (organization_id, id, asset_id, asset_kind, result) values
  (tests.org('A'), 'c-1', 'set-a1', 'SET', 'PASSED');
insert into public.sterilization_releases (organization_id, id, asset_id, asset_kind, cycle_record_id, decision,
  physical_parameters_ok, packaging_integrity_ok, biological_indicator_result) values
  (tests.org('A'), 'r-1', 'set-a1', 'SET', 'c-1', 'RELEASED', true, true, 'NOT_REQUIRED');
select tests.eq(tests.rows($q$update public.instrument_sets set state = 'READY_FOR_PICKUP' where id = 'set-a1'$q$),
  1, 'a Set released after a passed cycle is made ready');
select tests.eq(tests.rows($q$update public.instruments set state = 'READY_FOR_PICKUP' where id = 'tool-a1'$q$),
  1, 'its instruments follow it with no release of their own');
select tests.eq(tests.rows($q$update public.instrument_sets set state = 'IN_STORAGE' where id = 'set-a1'$q$),
  1, 'a move between ready states needs no release');

-- Next round: the same release does not make it ready again; a new one does.
update public.instrument_sets set state = 'IN_WASHING' where id = 'set-a1';
update public.instrument_sets set state = 'AWAITING_RELEASE' where id = 'set-a1';
select tests.throws($q$update public.instrument_sets set state = 'READY_FOR_PICKUP' where id = 'set-a1'$q$,
  '23514', 'a release makes its Set ready only once');
insert into public.sterilization_cycles (organization_id, id, asset_id, asset_kind, result) values
  (tests.org('A'), 'c-2', 'set-a1', 'SET', 'PASSED');
insert into public.sterilization_releases (organization_id, id, asset_id, asset_kind, cycle_record_id, decision,
  physical_parameters_ok, packaging_integrity_ok, biological_indicator_result) values
  (tests.org('A'), 'r-2', 'set-a1', 'SET', 'c-2', 'RELEASED', true, true, 'PENDING');
select tests.eq(tests.rows($q$update public.instrument_sets set state = 'READY_FOR_PICKUP' where id = 'set-a1'$q$),
  1, 'the next release makes it ready again (a pending biological indicator is not a failed one)');
select tests.throws('select * from public.release_transitions', '42501', 'a hospital user cannot read the log');

reset role;
select set_config('request.jwt.claims', '', true);
select tests.eq((select string_agg(asset_id || ' ' || from_state || '>' || to_state || ' ' || release_id, ', '
                                   order by release_id)
                   from public.release_transitions),
  'set-a1 AWAITING_RELEASE>READY_FOR_PICKUP r-1, set-a1 AWAITING_RELEASE>READY_FOR_PICKUP r-2',
  'each ready change is logged with the release it used; refused ones, Set members and moves between ready states are not');
select tests.ok((select bool_and(changed_by = tests.uid('ster_a')) from public.release_transitions),
  'with the user who made the change');

-- The nightly checks: a change logged before the check (no release_id) with no passed release is named.
insert into public.release_transitions (organization_id, asset_kind, asset_id, from_state, to_state)
values (tests.org('A'), 'SET', 'set-a2', 'AWAITING_RELEASE', 'READY_FOR_PICKUP'),
       (tests.org('A'), 'TOOL', 'tool-a3', 'AWAITING_RELEASE', 'READY_FOR_PICKUP');
select tests.eq((select count(*)::int from found), 0, 'a change less than 12 hours old is not blamed yet');
update public.release_transitions set changed_at = changed_at - interval '1 day';
update public.sterilization_releases set created_at = created_at - interval '3 days';
select tests.eq((select n from found where hospital = 'Hospital A' and check_name = 'ready without a passed release'),
  2, 'the Set and the instrument made ready with no release are named; a checked change is not, however late its release');
update public.sterilization_cycles set result = 'FAILED' where id = 'c-2';
select tests.eq((select n from found where check_name = 'ready without a passed release'),
  3, 'a release of a failed cycle does not count');
update public.release_transitions set changed_at = changed_at - interval '3 days';
select tests.eq((select count(*)::int from found), 0, 'a change already looked at by two nightly runs is not named again');

-- Each foreign key of the log has an index, and the trigger function is not callable through the API.
select tests.ok(exists (select 1 from pg_indexes where tablename = 'release_transitions'
                          and indexdef like '%(organization_id)%')
            and exists (select 1 from pg_indexes where tablename = 'release_transitions'
                          and indexdef like '%(changed_by)%'),
  'the log''s foreign keys are indexed');
select tests.ok(not has_function_privilege('authenticated', 'public.require_release_for_ready()', 'execute')
            and not has_function_privilege('anon', 'public.require_release_for_ready()', 'execute'),
  'the check is not callable by signed-in users or visitors');

rollback;
