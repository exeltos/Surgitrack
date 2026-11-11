-- Who is connected, as a hospital's administrator reads it: their own hospital's people only, no address; a department
-- user reads nothing; the platform owner reads any hospital.
begin;
\ir ../local/fixtures.sql

select tests.login('dept_a');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.5"}', true);
select public.touch_presence('Firefox');
select tests.login('ster_b');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.77"}', true);
select public.touch_presence('Chrome');

select tests.login('admin_a');
select tests.eq((select count(*)::int from public.hospital_presence()), 1, 'the admin sees the people of their hospital connected now');
select tests.eq((select user_id from public.hospital_presence()), tests.uid('dept_a'), 'and not those of another hospital');

select tests.login('dept_a');
select tests.eq((select count(*)::int from public.hospital_presence()), 0, 'a department user sees nobody');

select tests.login('platform');
select tests.eq((select count(*)::int from public.hospital_presence()), 2, 'the owner sees every hospital');
select tests.eq((select count(*)::int from public.hospital_presence(tests.org('B'))), 1, 'or one hospital');

select tests.service();
update public.user_presence set last_seen = now() - interval '20 minutes' where user_id = tests.uid('dept_a');
select tests.login('admin_a');
select tests.eq((select count(*)::int from public.hospital_presence()), 0, 'a person not seen for 20 minutes is not connected');

rollback;
