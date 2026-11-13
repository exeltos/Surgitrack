-- One-time handover passes (the QR a department person shows): nobody signed in can read, make or take them,
-- and a pass is taken once, unexpired, in its own hospital only.
begin;
\ir ../local/fixtures.sql

insert into public.handover_passes (organization_id, user_id, token_hash, expires_at) values
  (tests.org('A'), tests.uid('dept_a'), 'hash-live', now() + interval '45 seconds'),
  (tests.org('A'), tests.uid('dept_a'), 'hash-old', now() - interval '1 second');

select tests.login('ster_a');
select tests.throws($q$select * from public.handover_passes$q$, '42501', 'a signed-in user cannot read the passes');
select tests.throws($q$select public.consume_handover_pass('hash-live', tests.org('A'))$q$, '42501',
  'nor take one');

select tests.service();
select tests.ok(public.consume_handover_pass('hash-live', tests.org('B')) is null, 'a pass works only in its hospital');
select tests.eq(public.consume_handover_pass('hash-live', tests.org('A')), tests.uid('dept_a'), 'a live pass names its person');
select tests.ok(public.consume_handover_pass('hash-live', tests.org('A')) is null, 'a pass is used once');
select tests.ok(public.consume_handover_pass('hash-old', tests.org('A')) is null, 'an expired pass is refused');

rollback;
