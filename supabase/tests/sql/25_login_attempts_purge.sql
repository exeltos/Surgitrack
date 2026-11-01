-- The rate limiter's table is cleared every night: rows older than a day go, recent ones (which the limits still
-- count) stay, and nobody signed in can call the purge.
begin;
\ir ../local/fixtures.sql

insert into public.login_attempts (user_code, ip, succeeded, attempted_at) values
  ('device:old', 'device:old', false, now() - interval '2 days'),
  ('device:old', 'device:old', true, now() - interval '30 hours'),
  ('device:new', 'device:new', false, now() - interval '50 minutes'),
  ('device:new', 'device:new', false, now());
select public.purge_login_attempts();
select tests.eq((select count(*)::int from public.login_attempts where user_code = 'device:old'), 0, 'rows older than a day are removed');
select tests.eq((select count(*)::int from public.login_attempts where user_code = 'device:new'), 2, 'recent rows stay, the limits still count them');

select tests.ok((select command from cron.job where jobname = 'nightly-purge') ~ 'purge_login_attempts\(\)'
  and (select command from cron.job where jobname = 'nightly-purge') ~ 'purge_client_errors\(\)'
  and (select command from cron.job where jobname = 'nightly-purge') ~ 'purge_recycle_bin\(\)',
  'the nightly job runs it, next to the purges it already ran');

select tests.login('admin_a');
select tests.throws('select public.purge_login_attempts()', '42501', 'a hospital admin cannot call it');
select tests.anon();
select tests.throws('select public.purge_login_attempts()', '42501', 'nor a signed-out visitor');

-- The limiter still blocks after the purge: the 31st request of a device in a window is refused.
reset role;
select tests.eq((select count(*)::int from (select public.reserve_login_attempt('device:x', 'device:x', 10, 30, 30) from generate_series(1, 30)) s where s.reserve_login_attempt is not null), 30, '30 requests of a device pass');
select tests.ok(public.reserve_login_attempt('device:x', 'device:x', 10, 30, 30) is null, 'the 31st is refused');
select tests.ok(public.reserve_login_attempt('device:y', 'device:y', 10, 30, 30) is not null, 'another device is not affected');

rollback;
