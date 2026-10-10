-- Notices to every user: everyone signed in reads them; only the platform owner writes, ends or deletes them.
begin;
\ir ../local/fixtures.sql

select tests.login('platform');
select tests.eq(tests.rows($q$insert into public.platform_notices (message, ends_at) values ('Συντήρηση', now() + interval '1 day')$q$),
  1, 'the platform owner adds a notice');
select tests.eq(tests.rows($q$update public.platform_notices set ends_at = now() + interval '1 hour'$q$), 1,
  'the platform owner ends it early');
select tests.throws($q$insert into public.platform_notices (message) values ('   ')$q$, '23514', 'an empty notice is refused');
select tests.throws(
  $q$insert into public.platform_notices (message, starts_at, ends_at) values ('x', now(), now() - interval '1 hour')$q$,
  '23514', 'a notice cannot end before it starts');

select tests.login('dept_a');
select tests.eq(tests.count('select 1 from public.platform_notices'), 1, 'a department user reads the notice');
select tests.throws($q$insert into public.platform_notices (message) values ('x')$q$, '42501', 'a user adds no notice');
select tests.login('admin_a');
select tests.eq(tests.rows($q$update public.platform_notices set message = 'x'$q$), 0, 'a hospital admin changes none');
select tests.eq(tests.rows('delete from public.platform_notices'), 0, 'a hospital admin deletes none');

select tests.anon();
select tests.throws('select 1 from public.platform_notices', '42501', 'signed-out visitors read nothing');

rollback;
