-- Who a person is: the sign-in email and username change only through the staff functions; what others
-- did to an account is kept in account_events, which only admins read and nobody signed in changes; the
-- platform owner's account cannot be claimed again by another account or with an unconfirmed email.
begin;
\ir ../local/fixtures.sql

select tests.login('admin_a');
select tests.throws(format(
  $q$update public.profiles set email = 'admin_a@test.local' where id = %L$q$, tests.uid('dept_a')),
  '42501', 'a hospital admin cannot rewrite another user''s sign-in email');
select tests.throws(format(
  $q$update public.profiles set user_code = 'AB1234' where id = %L$q$, tests.uid('dept_a')),
  '42501', 'nor their username');
select tests.eq(tests.rows(format(
  $q$update public.profiles set name = 'Dept A', active = false where id = %L$q$, tests.uid('dept_a'))), 1,
  'a hospital admin still edits the other fields');

select tests.login('platform');
select tests.throws(format(
  $q$update public.profiles set email = 'x@test.local' where id = %L$q$, tests.uid('dept_a')),
  '42501', 'not even the platform owner, straight in the table');

select tests.service();
select tests.eq(tests.rows(format(
  $q$update public.profiles set email = 'dept.a@test.local' where id = %L$q$, tests.uid('dept_a'))), 1,
  'the staff functions (service role) change it');
select tests.eq(tests.rows(format(
  $q$insert into public.account_events (organization_id, target_id, actor_id, action) values
     (%L, %L, %L, 'password_link'), (%L, %L, %L, 'email_changed')$q$,
  tests.org('A'), tests.uid('dept_a'), tests.uid('admin_a'), tests.org('B'), tests.uid('ster_b'), tests.uid('admin_b'))), 2,
  'the staff functions record what they did');

select tests.login('admin_a');
select tests.eq(tests.count('select 1 from public.account_events'), 1, 'a hospital admin reads their hospital''s events');
select tests.throws($q$insert into public.account_events (action) values ('password_link')$q$, '42501',
  'a hospital admin adds no event');
select tests.throws('delete from public.account_events', '42501', 'nor removes one');
select tests.throws($q$update public.account_events set action = 'invite_link'$q$, '42501', 'nor changes one');
select tests.login('dept_a');
select tests.eq(tests.count('select 1 from public.account_events'), 0, 'other users read none');
select tests.login('platform');
select tests.eq(tests.count('select 1 from public.account_events'), 2, 'the platform owner reads all');

-- The platform owner's address, registered by a second account.
reset role;
insert into auth.users (id, email) values (tests.uid('impostor'), 'info@exeltos.com');
select tests.ok(not exists (select 1 from public.profiles where id = tests.uid('impostor')),
  'a new account with the owner''s address is not made platform owner');
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims',
  json_build_object('sub', tests.uid('impostor'), 'role', 'authenticated', 'email', 'info@exeltos.com')::text, true);
select tests.throws('select public.claim_platform_admin()', '42501', 'nor can it claim it');
reset role;
update auth.users set email_confirmed_at = now() where id = tests.uid('impostor');
select set_config('role', 'authenticated', true);
select tests.throws('select public.claim_platform_admin()', '42501',
  'not even with a confirmed email, while a platform owner exists');

rollback;
