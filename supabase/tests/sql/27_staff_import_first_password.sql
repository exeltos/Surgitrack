-- People made by the staff import must change their first password: until they do, the database shows them none of
-- the hospital's data, nobody signed in can lift the requirement with a direct write, and the nightly job locks the
-- ones who never did within the deadline.
begin;
\ir ../local/fixtures.sql

-- dept_a is one of those people.
update public.profiles set password_change_required = true, password_change_deadline = now() + interval '7 days'
 where id = tests.uid('dept_a');

-- The database holds them to it ---------------------------------------------------------------------------------
select tests.login('dept_a');
select tests.ok((select public.current_org_id()) is null, 'their hospital is not theirs yet');
select tests.ok((select public."current_role"()) is null, 'nor their role');
select tests.eq(tests.count('select * from public.departments'), 0, 'they see none of the hospital''s data');
select tests.eq(tests.count('select id from public.profiles'), 1, 'only their own profile');
select tests.ok((select password_change_required from public.profiles where id = tests.uid('dept_a')),
  'which tells them why (the flag is readable)');
select tests.ok((select password_change_deadline is not null from public.profiles where id = tests.uid('dept_a')), 'and by when');
select tests.eq(tests.rows($q$insert into public.client_errors (kind, message) values ('error', 'x')$q$), 1, 'they can still report an error');

-- A colleague with the requirement lifted is unaffected.
select tests.login('ster_a');
select tests.ok((select public.current_org_id()) = tests.org('A'), 'everyone else keeps their hospital');
select tests.ok(tests.count('select * from public.departments') > 0, 'and its data');

-- Nobody lifts it with a direct write ------------------------------------------------------------------------
select tests.login('admin_a');
select tests.throws(format($q$update public.profiles set password_change_required = false where id = %L$q$, tests.uid('dept_a')),
  '42501', 'a hospital admin cannot lift it');
select tests.throws(format($q$update public.profiles set password_change_deadline = now() + interval '1 year' where id = %L$q$, tests.uid('dept_a')),
  '42501', 'nor extend the deadline');
select tests.eq(tests.rows(format($q$update public.profiles set name = 'RENAMED' where id = %L$q$, tests.uid('dept_a'))), 1,
  'but still edits the rest of the person');
select tests.login('platform');
select tests.throws(format($q$update public.profiles set password_change_required = false where id = %L$q$, tests.uid('dept_a')),
  '42501', 'not even the platform owner through the API');
select tests.login('dept_a');
select tests.eq(tests.rows(format($q$update public.profiles set password_change_required = false where id = %L$q$, tests.uid('dept_a'))), 0,
  'and the person cannot lift it themselves');
select tests.service();
select tests.eq(tests.rows(format($q$update public.profiles set password_change_required = false, password_change_deadline = null where id = %L$q$, tests.uid('dept_a'))), 1,
  'only the staff functions (service role) do');
select tests.login('dept_a');
select tests.ok((select public.current_org_id()) = tests.org('A'), 'after which the hospital is theirs');

-- The deadline ---------------------------------------------------------------------------------------------------
reset role;
update public.profiles set password_change_required = true, password_change_deadline = now() - interval '1 hour'
 where id = tests.uid('dept_a');
update public.profiles set password_change_required = true, password_change_deadline = now() + interval '3 days'
 where id = tests.uid('viewer_a');
select tests.eq(public.lock_unchanged_passwords(), 1, 'the night job locks the one past the deadline');
select tests.ok(not (select active from public.profiles where id = tests.uid('dept_a')), 'who is now inactive');
select tests.ok((select active from public.profiles where id = tests.uid('viewer_a')), 'and leaves the one still within it');
select tests.ok((select active from public.profiles where id = tests.uid('ster_a')), 'and everyone with no requirement');
select tests.eq(public.lock_unchanged_passwords(), 0, 'a second run locks nobody more');
select tests.ok(exists (select 1 from cron.job where jobname = 'lock-unchanged-passwords'), 'it runs every night');
select tests.login('admin_a');
select tests.throws('select public.lock_unchanged_passwords()', '42501', 'and no signed-in person can call it');

-- The audit trail records an import.
select tests.service();
select tests.eq(tests.rows(format($q$insert into public.account_events (organization_id, target_id, actor_id, action)
  values (%L, %L, %L, 'staff_imported')$q$, tests.org('A'), tests.uid('dept_a'), tests.uid('platform'))), 1,
  'account_events accepts staff_imported');

rollback;
