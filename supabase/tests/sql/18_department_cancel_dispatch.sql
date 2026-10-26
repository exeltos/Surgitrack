-- The department cancels its own dispatch while Sterilization has not received it: the Set comes back with the
-- sterile dates it had (kept aside by the dispatch, not taken from the device), and only its own, only then.
begin;
\ir ../local/fixtures.sql

reset role;
update public.instrument_sets set state = 'IN_DEPARTMENT', extra = '{"sterileUntil":"2027-01-01","sterilizedOn":"2026-07-01"}'
  where id = 'set-a1';
update public.instrument_sets set state = 'IN_DEPARTMENT', extra = null where id = 'set-a2';

select tests.login('dept_a');
update public.instrument_sets set state = 'PENDING_STERILIZATION', extra = null where id = 'set-a1';
reset role;
select tests.eq((select state || '|' || coalesce(extra->>'sterileUntil', '-') || '|' || (extra->'dispatchedSterile'->>'sterileUntil')
  from public.instrument_sets where id = 'set-a1'), 'PENDING_STERILIZATION|-|2027-01-01',
  'the dispatch takes the sterile dates off and keeps them aside');

-- Dates sent by the device are ignored: they come back from what the dispatch kept.
select tests.login('dept_a');
select tests.eq(tests.rows($$update public.instrument_sets set state = 'IN_DEPARTMENT',
  extra = '{"sterileUntil":"2099-12-31"}' where id = 'set-a1'$$), 1, 'a department user cancels their dispatch');
reset role;
select tests.eq((select state || '|' || (extra->>'sterileUntil') || '|' || (extra->>'sterilizedOn') || '|'
  || coalesce(extra->>'dispatchedSterile', '-') from public.instrument_sets where id = 'set-a1'),
  'IN_DEPARTMENT|2027-01-01|2026-07-01|-', '... the Set is back, with its own sterile dates');

-- A Set with no sterile dates comes back without any.
select tests.login('dept_a');
update public.instrument_sets set state = 'PENDING_STERILIZATION' where id = 'set-a2';
update public.instrument_sets set state = 'IN_DEPARTMENT', extra = '{"sterileUntil":"2099-12-31"}' where id = 'set-a2';
reset role;
select tests.eq((select state || '|' || coalesce(extra::text, '-') from public.instrument_sets where id = 'set-a2'),
  'IN_DEPARTMENT|-', 'a dispatch without sterile dates is cancelled without inventing any');

-- Once Sterilization received it, the department cannot take it back.
select tests.service();
update public.instrument_sets set state = 'IN_WASHING' where id = 'set-a2';
select tests.login('dept_a');
update public.instrument_sets set state = 'IN_DEPARTMENT' where id = 'set-a2';
reset role;
select tests.eq((select state from public.instrument_sets where id = 'set-a2'), 'IN_WASHING',
  'a Set Sterilization already received stays there');

rollback;
