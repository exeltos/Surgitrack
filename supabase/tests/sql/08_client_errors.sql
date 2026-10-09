-- Errors users meet: anyone signed in reports their own (viewers too), for their own hospital; only the
-- platform owner reads and clears them; signed-out visitors report nothing; a nightly job purges old ones.
begin;
\ir ../local/fixtures.sql

select tests.login('viewer_a');
select tests.eq(tests.rows(format(
  $q$insert into public.client_errors (organization_id, kind, message, route) values (%L, 'error', 'x is undefined', '/sets')$q$,
  tests.org('A'))), 1, 'a viewer reports an error');
select tests.login('dept_a');
select tests.eq(tests.rows($q$insert into public.client_errors (kind, message) values ('rejection', 'fetch failed')$q$), 1,
  'a user reports without a hospital');
select tests.throws(format(
  $q$insert into public.client_errors (organization_id, kind, message) values (%L, 'error', 'x')$q$, tests.org('B')),
  '42501', 'nobody reports for another hospital');
select tests.throws(format(
  $q$insert into public.client_errors (user_id, kind, message) values (%L, 'error', 'x')$q$, tests.uid('admin_a')),
  '42501', 'nobody reports in someone else''s name');
select tests.eq(tests.count('select 1 from public.client_errors'), 0, 'a user reads no errors, not even their own');
select tests.login('admin_a');
select tests.eq(tests.count('select 1 from public.client_errors'), 0, 'a hospital admin reads no errors');
select tests.eq(tests.rows('delete from public.client_errors'), 0, 'a hospital admin clears nothing');

select tests.login('platform');
select tests.eq(tests.count('select 1 from public.client_errors'), 2, 'the platform owner reads them all');
select tests.eq(tests.rows($q$delete from public.client_errors where kind = 'rejection'$q$), 1, 'the platform owner clears');

select tests.anon();
select tests.throws($q$insert into public.client_errors (kind, message) values ('error', 'x')$q$, '42501',
  'signed-out visitors report nothing');
reset role;
select tests.ok(exists (select 1 from cron.job where jobname = 'nightly-purge'), 'old errors are purged every night');

rollback;
