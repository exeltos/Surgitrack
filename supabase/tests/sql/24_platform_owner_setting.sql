-- The platform owner's address is one private row, not code: nobody signed in reads or writes it, the two functions
-- that use it follow it, and the app only asks whether the caller is the owner.
begin;
\ir ../local/fixtures.sql

select tests.eq((select email from public.platform_owner), 'info@exeltos.com', 'the seeded owner is the address that was in the code');

select tests.login('admin_a');
select tests.throws('select * from public.platform_owner', '42501', 'a hospital admin cannot read it');
select tests.throws($q$update public.platform_owner set email = 'me@test.local'$q$, '42501', 'nor change it');
select tests.login('platform');
select tests.throws($q$update public.platform_owner set email = 'me@test.local'$q$, '42501', 'not even the platform owner through the API');
select tests.anon();
select tests.throws('select * from public.platform_owner', '42501', 'nor a signed-out visitor');
select tests.throws('select public.caller_is_platform_owner()', '42501', 'who is not offered the question either');

-- Who the database takes for the owner follows the row.
reset role;
insert into auth.users (id, email, email_confirmed_at) values (tests.uid('owner_b'), 'info@exeltos.com', now())
  on conflict do nothing;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims',
  json_build_object('sub', tests.uid('admin_a'), 'role', 'authenticated', 'email', 'admin_a@test.local')::text, true);
select tests.ok(public.caller_is_platform_owner() is false, 'an ordinary signed-in person is not the owner');

reset role;
update public.platform_owner set email = 'admin_a@test.local';
update auth.users set email_confirmed_at = now() where id = tests.uid('admin_a');
select tests.login('admin_a');
select tests.ok(public.caller_is_platform_owner(), 'after the row changes, that person is');
select tests.login('platform');
select tests.ok(public.caller_is_platform_owner() is false, 'and the old address no longer is');

-- An unconfirmed address is not the owner.
reset role;
update auth.users set email_confirmed_at = null where id = tests.uid('admin_a');
select tests.login('admin_a');
select tests.ok(public.caller_is_platform_owner() is false, 'an unconfirmed address is not the owner');

-- The claim follows the row: with another platform admin present it is refused, as before.
reset role;
update auth.users set email_confirmed_at = now() where id = tests.uid('admin_a');
select tests.login('admin_a');
select tests.throws('select public.claim_platform_admin()', '42501', 'a claim is refused while another platform admin exists');

-- Once there is none, the new owner (and only the new owner) can claim.
reset role;
delete from public.profiles where organization_id is null and role = 'ADMIN';
select tests.login('platform');
select tests.throws('select public.claim_platform_admin()', '42501', 'the old address can no longer claim');
select tests.login('admin_a');
select tests.ok((select (public.claim_platform_admin()).role::text = 'ADMIN'), 'the new owner claims the platform admin account');
reset role;
select tests.ok((select organization_id is null and email = 'admin_a@test.local' from public.profiles where id = tests.uid('admin_a')),
  'with no hospital, under the new address');

rollback;
