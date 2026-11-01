-- Only the platform owner makes a hospital administrator: not by a direct write to profiles, and not by approving
-- a signup as Admin. The staff functions (service role) check the same rule in their own code.
begin;
\ir ../local/fixtures.sql

-- A direct write ---------------------------------------------------------------------------------------------
select tests.login('admin_a');
select tests.throws(format($q$update public.profiles set role = 'ADMIN' where id = %L$q$, tests.uid('dept_a')), '42501',
  'a hospital admin cannot give someone the Admin role');
select tests.eq(tests.rows(format($q$update public.profiles set role = 'VIEWER' where id = %L$q$, tests.uid('dept_a'))), 1,
  'but still sets the other roles');
select tests.eq((select role::text from public.profiles where id = tests.uid('dept_a')), 'VIEWER', 'and the role changed');

-- Approving a signup as Admin ---------------------------------------------------------------------------------
select tests.service();
insert into public.staff_access_requests (organization_id, user_id, full_name, email, status)
values (tests.org('A'), tests.uid('viewer_a'), 'Applicant', 'applicant@test.local', 'PENDING');
select tests.login('admin_a');
select tests.throws(format($q$select public.hospital_decide_access_request(%L, true, 'ADMIN')$q$,
  (select id from public.staff_access_requests where status = 'PENDING')), '42501', 'nor approve a signup as Admin');
select tests.eq((select role::text from public.profiles where id = tests.uid('viewer_a')), 'VIEWER',
  'the applicant is not an admin');
select public.hospital_decide_access_request(
  (select id from public.staff_access_requests where status = 'PENDING'), true, 'DEPARTMENT',
  (select id from public.departments where organization_id = tests.org('A') limit 1));
select tests.eq((select role::text from public.profiles where id = tests.uid('viewer_a')), 'DEPARTMENT',
  'approving it as another role works');

-- The platform owner and the service role ------------------------------------------------------------------------
select tests.login('platform');
select tests.eq(tests.rows(format($q$update public.profiles set role = 'ADMIN' where id = %L$q$, tests.uid('dept_a'))), 1,
  'the platform owner makes an admin');
select tests.service();
select tests.eq(tests.rows(format($q$update public.profiles set role = 'ADMIN' where id = %L$q$, tests.uid('ster_a'))), 1,
  'and the staff functions (service role) are not limited by the database');
select tests.eq(tests.rows(format($q$update public.profiles set name = 'Renamed' where id = %L$q$, tests.uid('dept_a'))), 1,
  'an admin''s other fields still change');

rollback;
