-- The owner's security view: who is connected now (with the address the gateway saw), and blocking an address. A blocked
-- address shows no hospital's data; the platform owner is never held to a block; only the owner reads or changes any of it.
begin;
\ir ../local/fixtures.sql

-- The app's minute -------------------------------------------------------------------------------------------------
select tests.login('dept_a');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.5"}', true);
select tests.ok(((select public.touch_presence('Firefox'))->>'allowed')::boolean, 'a first minute is allowed');
select tests.login('ster_a');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.77"}', true);
select public.touch_presence('Chrome');
select tests.service();
select tests.eq(tests.count('select * from public.user_presence'), 2, 'each person has one row');
select public.touch_presence('x');

-- Only the owner reads ---------------------------------------------------------------------------------------------
select tests.login('admin_a');
select tests.throws('select * from public.platform_active_sessions()', '42501', 'a hospital admin cannot list who is connected');
select tests.eq(tests.count('select * from public.user_presence'), 0, 'nor read the table');
select tests.throws($q$select public.platform_block_ip('203.0.113.5')$q$, '42501', 'nor block an address');
select tests.eq(tests.count('select * from public.blocked_ips'), 0, 'nor read the blocked ones');

select tests.login('platform');
select tests.eq((select count(*)::int from public.platform_active_sessions() where ip = '203.0.113.5'), 1,
  'the owner sees the person and their address');
select tests.eq((select organization_name from public.platform_active_sessions() where ip = '203.0.113.5'), (select name from public.organizations where id = tests.org('A')),
  'with the hospital');

-- Someone not seen for ten minutes is not "now"
select tests.service();
update public.user_presence set last_seen = now() - interval '20 minutes' where user_id = tests.uid('ster_a');
select tests.login('platform');
select tests.eq((select count(*)::int from public.platform_active_sessions()), 1, 'a person not seen for 20 minutes is not listed');
select tests.eq((select count(*)::int from public.platform_active_sessions(60)), 2, 'unless the owner widens the window');

-- Blocking ---------------------------------------------------------------------------------------------------------
select tests.throws($q$select public.platform_block_ip('10.0.0.0/8')$q$, '22023', 'a whole network is refused');
select public.platform_block_ip('203.0.113.5', 'tried too many times');
select tests.eq((select ip_blocked from public.platform_active_sessions() where ip = '203.0.113.5'), true, 'the list says which are blocked');

select tests.login('dept_a');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.5"}', true);
select tests.ok((select public.current_org_id()) is null, 'a blocked address has no hospital');
select tests.eq(tests.count('select * from public.departments'), 0, 'and sees none of its data');
select tests.ok(((select public.my_ip_access())->>'allowed')::boolean = false, 'the app is told it is refused');
select tests.ok(((select public.touch_presence('Firefox'))->>'allowed')::boolean = false, 'and its minute says so too');
select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.9"}', true);
select tests.ok((select public.current_org_id()) = tests.org('A'), 'the same person from another address works');
select tests.login('ster_a');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.6"}', true);
select tests.ok((select public.current_org_id()) = tests.org('A'), 'a neighbouring address is not blocked');

select tests.login('platform');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.5"}', true);
select tests.ok(tests.count('select * from public.departments') > 0, 'the owner works from a blocked address and sees every hospital');
select tests.ok(((select public.touch_presence('Chrome'))->>'allowed')::boolean, 'and is told they may stay');

-- A hospital's own rule still applies as before, and unblocking lets the address back in
select public.platform_block_ip('203.0.113.0/28');
select tests.eq((select count(*)::int from public.blocked_ips), 2, 'a small range can be blocked as well');
select public.platform_unblock_ip('203.0.113.0/28');
select public.platform_unblock_ip('203.0.113.5');
select tests.eq((select count(*)::int from public.blocked_ips), 0, 'and they are unblocked');
select tests.login('dept_a');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.5"}', true);
select tests.ok((select public.current_org_id()) = tests.org('A'), 'an unblocked address is let back in');

rollback;
