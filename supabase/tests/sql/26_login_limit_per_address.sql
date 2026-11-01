-- A username is locked per ADDRESS first: five wrong passwords from one address stop that address, not the person,
-- who can still sign in from theirs. Ceilings per username and per address stay, and callers that pass no
-- per-address limit behave as before.
begin;
\ir ../local/fixtures.sql

-- Five wrong passwords for AB1234 from one address.
select tests.eq((select count(*)::int from (select public.reserve_login_attempt('AB1234', '203.0.113.1', 15, 30, 20, 5) r
  from generate_series(1, 5)) s where s.r is not null), 5, 'five attempts from one address pass');
select tests.ok(public.reserve_login_attempt('AB1234', '203.0.113.1', 15, 30, 20, 5) is null, 'the sixth from that address is refused');
select tests.ok(public.reserve_login_attempt('AB1234', '203.0.113.2', 15, 30, 20, 5) is not null,
  'but the person''s own address is not locked out by it');
select tests.ok(public.reserve_login_attempt('CD5678', '203.0.113.1', 15, 30, 20, 5) is not null,
  'and the blocked address can still try another username (up to its own ceiling)');

-- A guess spread over many addresses meets the ceiling per username.
select tests.eq((select count(*)::int from (select public.reserve_login_attempt('EF9012', '198.51.100.' || n, 15, 30, 100, 5) r
  from generate_series(1, 30) n) s where s.r is not null), 30, '30 attempts from 30 addresses pass');
select tests.ok(public.reserve_login_attempt('EF9012', '198.51.100.200', 15, 30, 100, 5) is null,
  'the 31st, from yet another address, is refused: the ceiling per username');

-- The ceiling per address.
select tests.eq((select count(*)::int from (select public.reserve_login_attempt('GH' || lpad(n::text, 4, '0'), '192.0.2.1', 15, 30, 20, 5) r
  from generate_series(1, 20) n) s where s.r is not null), 20, '20 attempts at 20 usernames from one address pass');
select tests.ok(public.reserve_login_attempt('GH9999', '192.0.2.1', 15, 30, 20, 5) is null, 'the 21st from that address is refused');

-- A correct password frees the address: an attempt marked as succeeded no longer counts.
update public.login_attempts set succeeded = true where user_code = 'AB1234' and ip = '203.0.113.1';
select tests.ok(public.reserve_login_attempt('AB1234', '203.0.113.1', 15, 30, 20, 5) is not null, 'after a success the address can try again');

-- Without the per-address limit (signup, device-ingest, verify-handover) the answers are those of before.
select tests.eq((select count(*)::int from (select public.reserve_login_attempt('device:z', 'device:z', 10, 30, 30) r
  from generate_series(1, 30)) s where s.r is not null), 30, 'five-argument callers: 30 pass');
select tests.ok(public.reserve_login_attempt('device:z', 'device:z', 10, 30, 30) is null, 'and the 31st is refused');

-- Nobody signed in can call it, and there is one function of that name.
select tests.eq((select count(*)::int from pg_proc where proname = 'reserve_login_attempt' and pronamespace = 'public'::regnamespace), 1,
  'a single reserve_login_attempt');
select tests.ok(not has_function_privilege('authenticated', 'public.reserve_login_attempt(text,text,int,int,int,int)', 'execute')
  and not has_function_privilege('anon', 'public.reserve_login_attempt(text,text,int,int,int,int)', 'execute')
  and has_function_privilege('service_role', 'public.reserve_login_attempt(text,text,int,int,int,int)', 'execute'),
  'only the service role calls it');

rollback;
