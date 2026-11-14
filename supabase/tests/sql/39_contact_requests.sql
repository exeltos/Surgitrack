-- «Ζητήστε παρουσίαση»: only the edge function (service role) stores a request; only the platform owner reads,
-- marks handled or deletes them; visitors and hospital users see nothing.
begin;
\ir ../local/fixtures.sql

select tests.service();
insert into public.contact_requests (name, organization, role, email, phone, message, ip_hash)
values ('Μαρία Π.', 'Γενικό Νοσοκομείο', 'Προϊσταμένη ΚΑ', 'maria@example.test', '2100000000', 'Θα θέλαμε παρουσίαση.', 'h1');

select tests.anon();
select tests.throws('select 1 from public.contact_requests', '42501', 'a visitor reads no request');
select tests.throws($q$insert into public.contact_requests (name, email, message) values ('Χ Χ', 'x@example.test', 'γεια σας')$q$,
  '42501', 'nor writes one directly');

select tests.login('admin_a');
select tests.eq(tests.count('select 1 from public.contact_requests'), 0, 'a hospital admin sees none');
select tests.eq(tests.rows('update public.contact_requests set handled_at = now()'), 0, 'nor marks one');
select tests.throws($q$update public.contact_requests set message = 'άλλο'$q$, '42501', 'nobody rewrites a message');

select tests.login('platform');
select tests.eq(tests.count('select 1 from public.contact_requests'), 1, 'the platform owner reads them');
select tests.eq(tests.rows('update public.contact_requests set handled_at = now()'), 1, 'marks one handled');
select tests.eq(tests.rows('delete from public.contact_requests'), 1, 'and deletes one');

select tests.service();
select tests.throws($q$insert into public.contact_requests (name, email, message) values ('X', 'x@example.test', 'hello there')$q$,
  '23514', 'a request needs a real name');

rollback;

-- The limits and the insert in one step (submit_contact_request): only the service role calls it.
begin;
\ir ../local/fixtures.sql
select tests.login('platform');
select tests.throws($q$select public.submit_contact_request('Μαρία', null, null, 'm@example.test', null, 'γεια σας', 'h', 3, 30)$q$,
  '42501', 'no signed-in user calls submit_contact_request');
select tests.anon();
select tests.throws($q$select public.submit_contact_request('Μαρία', null, null, 'm@example.test', null, 'γεια σας', 'h', 3, 30)$q$,
  '42501', 'nor a visitor');
select tests.service();
delete from public.contact_requests;
select tests.eq(public.submit_contact_request('Μαρία', null, null, 'm@example.test', null, 'γεια σας', 'h1', 2, 3), 'ok', 'the first is stored');
select tests.eq(public.submit_contact_request('Μαρία', null, null, 'm@example.test', null, 'γεια σας', 'h1', 2, 3), 'ok', 'the second too');
select tests.eq(public.submit_contact_request('Μαρία', null, null, 'm@example.test', null, 'γεια σας', 'h1', 2, 3), 'too_many',
  'the third from the same address is refused');
select tests.eq(public.submit_contact_request('Νίκος', null, null, 'n@example.test', null, 'γεια σας', 'h2', 2, 3), 'ok',
  'another address still gets through');
select tests.eq(public.submit_contact_request('Ελένη', null, null, 'e@example.test', null, 'γεια σας', 'h3', 2, 3), 'too_many',
  'until the whole form reaches its hourly limit');
select tests.eq(tests.count('select 1 from public.contact_requests'), 3, 'only the accepted ones are kept');
rollback;
