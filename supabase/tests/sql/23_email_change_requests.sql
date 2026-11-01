-- A hospital admin's change of another person's sign-in email waits for the new address to confirm it. The waiting
-- requests (with the hash of the one-time token) are for the edge functions only: no signed-in person reads or
-- writes them, whatever their role.
begin;
\ir ../local/fixtures.sql

select tests.service();
insert into public.email_change_requests (organization_id, user_id, new_email, token_hash, requested_by)
values (tests.org('A'), tests.uid('dept_a'), 'new@test.local', repeat('a', 64), tests.uid('admin_a'));
select tests.eq(tests.count('select * from public.email_change_requests'), 1, 'the service role reads and writes them');
select tests.throws(format($q$insert into public.email_change_requests (organization_id, user_id, new_email, token_hash)
  values (%L, %L, 'other@test.local', repeat('b', 64))$q$, tests.org('A'), tests.uid('dept_a')), '23505',
  'one waiting request per person');

select tests.login('admin_a');
select tests.throws('select * from public.email_change_requests', '42501', 'a hospital admin cannot read them');
select tests.throws(format($q$insert into public.email_change_requests (organization_id, user_id, new_email, token_hash)
  values (%L, %L, 'x@test.local', repeat('c', 64))$q$, tests.org('A'), tests.uid('ster_a')), '42501',
  'nor write them');
select tests.login('platform');
select tests.throws('select * from public.email_change_requests', '42501', 'nor the platform owner through the API');
select tests.login('dept_a');
select tests.throws('select * from public.email_change_requests', '42501', 'nor the person concerned');
select tests.anon();
select tests.throws('select * from public.email_change_requests', '42501', 'nor a signed-out visitor');

-- The audit trail records the request.
select tests.service();
select tests.eq(tests.rows(format($q$insert into public.account_events (organization_id, target_id, actor_id, action)
  values (%L, %L, %L, 'email_change_requested')$q$, tests.org('A'), tests.uid('dept_a'), tests.uid('admin_a'))), 1,
  'account_events accepts email_change_requested');
select tests.throws(format($q$insert into public.account_events (organization_id, action) values (%L, 'something_else')$q$,
  tests.org('A')), '23514', 'and still only the known actions');

rollback;
