-- Notices and promotions: the platform owner chooses who sees one (everyone or only the hospital administrators)
-- and in which hospitals; a promotion is for the administrators, has a title, and a link opens over https only.
begin;
\ir ../local/fixtures.sql

select tests.login('platform');
-- To everyone, in every hospital.
insert into public.platform_notices (message) values ('Για όλους');
-- Only the administrators, every hospital.
insert into public.platform_notices (message, audience) values ('Μόνο διαχειριστές', 'ADMINS');
-- A promotion for hospital A only.
insert into public.platform_notices (message, kind, audience, title, link_url, link_label, organization_ids)
values ('Νέο προϊόν', 'PROMO', 'ADMINS', 'Προϊόν Χ', 'https://example.com/x', 'Δείτε', array[tests.org('A')]);
-- A notice for everyone, but in hospital B only.
insert into public.platform_notices (message, organization_ids) values ('Μόνο η Β', array[tests.org('B')]);

select tests.eq(tests.count('select 1 from public.platform_notices'), 4, 'the platform owner reads all of them');

select tests.login('admin_a');
select tests.eq(tests.count('select 1 from public.platform_notices'), 3, 'a hospital admin reads the ones for everyone, for administrators, and its own promotion');
select tests.eq(tests.count($q$select 1 from public.platform_notices where kind = 'PROMO'$q$), 1, 'including the promotion for its hospital');
select tests.eq(tests.count($q$select 1 from public.platform_notices where message = 'Μόνο η Β'$q$), 0, 'but not the one for another hospital');

select tests.login('admin_b');
select tests.eq(tests.count('select 1 from public.platform_notices'), 3, 'the other hospital''s admin reads its own notice instead of the promotion');
select tests.eq(tests.count($q$select 1 from public.platform_notices where kind = 'PROMO'$q$), 0, 'and not the promotion of hospital A');

select tests.login('dept_a');
select tests.eq(tests.count('select 1 from public.platform_notices'), 1, 'a department user reads only the one for everyone');
select tests.login('ster_a');
select tests.eq(tests.count('select 1 from public.platform_notices'), 1, 'so does a Sterilization user');

select tests.login('platform');
select tests.throws(
  $q$insert into public.platform_notices (message, kind, audience, title) values ('x', 'PROMO', 'ALL', 'T')$q$,
  '23514', 'a promotion is for the administrators only');
select tests.throws(
  $q$insert into public.platform_notices (message, kind, audience) values ('x', 'PROMO', 'ADMINS')$q$,
  '23514', 'and needs a title');
select tests.throws(
  $q$insert into public.platform_notices (message, link_url) values ('x', 'http://example.com')$q$,
  '23514', 'a link is https only');
select tests.throws(
  $q$insert into public.platform_notices (message, link_url) values ('x', 'javascript:alert(1)')$q$,
  '23514', 'and never a script');
select tests.throws(
  $q$insert into public.platform_notices (message, kind) values ('x', 'AD')$q$,
  '23514', 'the kind is a notice or a promotion');
select tests.throws(
  $q$insert into public.platform_notices (message, organization_ids) values ('x', '{}')$q$,
  '23514', 'a list of hospitals is never empty (all hospitals is no list)');

select tests.login('admin_a');
select tests.throws($q$insert into public.platform_notices (message) values ('x')$q$, '42501', 'a hospital admin still adds no notice');

rollback;
