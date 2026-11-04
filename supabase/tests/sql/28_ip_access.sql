-- Access by network: a hospital that enforces its allowed addresses shows nobody outside them any of its data; the
-- platform owner and the people exempted are never held to it; LOG mode only records; and only the owner sets it.
begin;
\ir ../local/fixtures.sql

select tests.service();
insert into public.ip_access (organization_id, mode, addresses)
values (tests.org('A'), 'ENFORCE', '[{"ip":"203.0.113.0/28","label":"hospital"},{"ip":"198.51.100.7","label":"wifi"}]');

-- Inside an allowed address ----------------------------------------------------------------------------------------
select tests.login('dept_a');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.5"}', true);
select tests.ok((select public.current_org_id()) = tests.org('A'), 'an address inside a range keeps the hospital');
select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.7"}', true);
select tests.ok((select public.current_org_id()) = tests.org('A'), 'a single allowed address does too');
select tests.ok(tests.count('select * from public.departments') > 0, 'with its data');

-- Outside ------------------------------------------------------------------------------------------------------------
select set_config('request.headers', '{"cf-connecting-ip":"192.0.2.44"}', true);
select tests.ok((select public.current_org_id()) is null, 'any other address has no hospital');
select tests.eq(tests.count('select * from public.departments'), 0, 'and sees none of its data');
select tests.eq(tests.count('select id from public.profiles'), 1, 'only their own profile (to know who they are)');
select set_config('request.headers', '{"x-forwarded-for":"6.6.6.6, 192.0.2.44"}', true);
select tests.ok((select public.current_org_id()) is null, 'the first x-forwarded-for entry, which a client writes, is not trusted');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.5","x-forwarded-for":"192.0.2.44"}', true);
select tests.ok((select public.current_org_id()) = tests.org('A'), 'the gateway''s address wins over x-forwarded-for');

-- No headers (Realtime, a direct connection): not blocked
select set_config('request.headers', '', true);
select tests.ok((select public.current_org_id()) = tests.org('A'), 'a request without headers is not blocked');

-- What the app asks ---------------------------------------------------------------------------------------------------
select set_config('request.headers', '{"cf-connecting-ip":"192.0.2.44"}', true);
select tests.ok(((select public.my_ip_access())->>'allowed')::boolean = false, 'the app is told this address is refused');
select tests.eq((select public.my_ip_access())->>'ip', '192.0.2.44', 'and which address was seen');
select tests.service();
select tests.eq(tests.count('select * from public.ip_access_log where blocked'), 1, 'it is recorded once');
select tests.login('dept_a');
select set_config('request.headers', '{"cf-connecting-ip":"192.0.2.44"}', true);
select public.my_ip_access();
select tests.service();
select tests.eq(tests.count('select * from public.ip_access_log'), 1, 'and not again within the hour');

-- Exempt people and the owner ---------------------------------------------------------------------------------------
update public.ip_access set exempt_users = array[tests.uid('dept_a')] where organization_id = tests.org('A');
select tests.login('dept_a');
select set_config('request.headers', '{"cf-connecting-ip":"192.0.2.44"}', true);
select tests.ok((select public.current_org_id()) = tests.org('A'), 'an exempted person works from anywhere');
select tests.login('ster_a');
select set_config('request.headers', '{"cf-connecting-ip":"192.0.2.44"}', true);
select tests.ok((select public.current_org_id()) is null, 'their colleague does not');
select tests.login('platform');
select set_config('request.headers', '{"cf-connecting-ip":"192.0.2.44"}', true);
select tests.ok((select public.is_platform_admin()), 'the platform owner works from anywhere');
select tests.ok(tests.count('select * from public.departments') > 0, 'and sees every hospital');

-- Another hospital is not touched, and the other modes ---------------------------------------------------------------
select tests.login('admin_b');
select set_config('request.headers', '{"cf-connecting-ip":"192.0.2.44"}', true);
select tests.ok((select public.current_org_id()) = tests.org('B'), 'a hospital with no rule is unaffected');
select tests.service();
update public.ip_access set mode = 'LOG' where organization_id = tests.org('A');
select tests.login('ster_a');
select set_config('request.headers', '{"cf-connecting-ip":"192.0.2.44"}', true);
select tests.ok((select public.current_org_id()) = tests.org('A'), 'LOG mode blocks nobody');
select tests.ok(((select public.my_ip_access())->>'mode') = 'LOG' and ((select public.my_ip_access())->>'allowed')::boolean = false,
  'but says the address would be refused');
select tests.service();
update public.ip_access set mode = 'OFF' where organization_id = tests.org('A');

-- Setting it -------------------------------------------------------------------------------------------------------------
select tests.login('admin_a');
select tests.throws(format($q$select public.platform_set_ip_access(%L, 'ENFORCE', '[{"ip":"203.0.113.5"}]', '{}')$q$, tests.org('A')),
  '42501', 'a hospital admin cannot set it');
select tests.eq(tests.count('select * from public.ip_access'), 0, 'nor read it');
select tests.login('platform');
select tests.throws(format($q$select public.platform_set_ip_access(%L, 'ENFORCE', '[{"ip":"not an ip"}]', '{}')$q$, tests.org('A')),
  '22023', 'an address that is not one is refused');
select tests.throws(format($q$select public.platform_set_ip_access(%L, 'ENFORCE', '[]', '{}')$q$, tests.org('A')),
  '22023', 'enforcing with no address is refused');
select public.platform_set_ip_access(tests.org('A'), 'LOG', '[{"ip":" 203.0.113.9 ","label":"x"}]', array[tests.uid('dept_a'), tests.uid('admin_b')]);
select tests.eq((select addresses->0->>'ip' from public.ip_access where organization_id = tests.org('A')), '203.0.113.9/32',
  'an address is kept as an address');
select tests.eq((select cardinality(exempt_users) from public.ip_access where organization_id = tests.org('A')), 1,
  'only people of that hospital can be exempted');
select tests.eq(tests.count('select * from public.ip_access_log'), 2, 'the owner reads the log');

rollback;
