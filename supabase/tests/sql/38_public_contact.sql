-- The company's contact on the public first page: anyone reads the four public fields (signed in or not), only
-- the platform owner changes them, and a signed-out visitor still reads nothing else of the platform settings.
begin;
\ir ../local/fixtures.sql

select tests.anon();
select tests.eq((select email from public.public_contact()), 'info@exeltos.com', 'a visitor reads the public email');
select tests.throws('select 1 from public.platform_settings', '42501', 'but not the platform settings themselves');

select tests.login('admin_a');
select tests.eq(tests.rows($q$update public.platform_settings set public_phone = '210 000 0000'$q$), 0,
  'a hospital admin changes no public detail');

select tests.login('platform');
select tests.eq(tests.rows($q$update public.platform_settings set public_phone = '210 123 4567'$q$), 1,
  'the platform owner changes them');
select tests.anon();
select tests.eq((select phone from public.public_contact()), '210 123 4567', 'and visitors see the change');

rollback;
