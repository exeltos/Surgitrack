-- Run after the staged migration is replayed (see README.md): colleagues' emails and usernames are no longer
-- readable from the table, the rest of the profile is, and profile_contacts() gives each role what it needs.
begin;
\ir ../tests/local/fixtures.sql

select tests.login('dept_a');
select tests.throws($q$select email from public.profiles$q$, '42501', 'a department user cannot read emails');
select tests.throws($q$select user_code from public.profiles$q$, '42501', 'nor usernames');
select tests.throws($q$select id from public.profiles where email like '%test.local'$q$, '42501', 'nor filter by email');
select tests.eq(tests.count('select id, name, role, active, organization_id from public.profiles'), 5,
  'the rest of the profile is still readable: the hospital''s people');
select tests.eq(tests.count('select * from public.profile_contacts()'), 1, 'they get only their own contact');
select tests.eq((select email from public.profile_contacts()), 'dept_a@test.local', 'their own email');

select tests.login('admin_a');
select tests.eq(tests.count(format('select * from public.profile_contacts(%L)', tests.org('A'))), 5,
  'a hospital admin gets their hospital''s contacts');
select tests.eq(tests.count(format('select * from public.profile_contacts(%L)', tests.org('B'))), 0,
  'and nothing of another hospital');
select tests.eq(tests.count('select * from public.profile_contacts()'), 5, 'with no hospital named, still only the hospital''s');

select tests.login('platform');
select tests.eq(tests.count('select * from public.profile_contacts()'), 8, 'the platform owner gets everyone''s');

select tests.service();
select tests.eq(tests.count('select email, user_code from public.profiles'), 8, 'the staff functions (service role) read them');

rollback;
