-- Found in the review of 1 Nov 2026: the error report flood cap, the signup email gate (the confirmation token
-- and activating an unconfirmed account), the trial lock on Storage, and profile_contacts().
begin;
\ir ../local/fixtures.sql

-- Error reports: 60 an hour per account -----------------------------------------------------------
select tests.service();
insert into public.client_errors (user_id, kind, message)
select tests.uid('dept_a'), 'error', 'old ' || n from generate_series(1, 59) n;
insert into public.client_errors (user_id, kind, message, occurred_at)
select tests.uid('dept_a'), 'error', 'yesterday ' || n, now() - interval '2 hours' from generate_series(1, 30) n;
select tests.login('dept_a');
select tests.eq(tests.rows($q$insert into public.client_errors (kind, message) values ('error', 'the 60th')$q$), 1,
  'the 60th report of the hour is accepted (older ones do not count)');
select tests.throws($q$insert into public.client_errors (kind, message) values ('error', 'the 61st')$q$, '54000',
  'the 61st is refused');
select tests.login('viewer_a');
select tests.eq(tests.rows($q$insert into public.client_errors (kind, message) values ('error', 'someone else')$q$), 1,
  'the cap is per account');
select tests.service();
select tests.eq(tests.rows($q$insert into public.client_errors (user_id, kind, message)
  select null, 'error', 'job ' || n from generate_series(1, 70) n$q$), 70, 'the service role is not limited');

-- Signup by link: the confirmation token and the unconfirmed account ---------------------------------
select tests.service();
insert into public.staff_access_requests (organization_id, user_id, full_name, email, status, confirm_token)
values (tests.org('A'), tests.uid('viewer_a'), 'Applicant', 'applicant@test.local', 'PENDING_EMAIL', 'secret-token');
update public.profiles set active = false where id = tests.uid('viewer_a');
select tests.eq((select confirm_token from public.staff_access_requests), 'secret-token', 'the staff functions read the token');

select tests.login('admin_a');
select tests.eq(tests.count('select id, status, email, invite_token from public.staff_access_requests'), 1,
  'a hospital admin still reads the requests');
select tests.throws('select confirm_token from public.staff_access_requests', '42501',
  'but not the confirmation token');
select tests.throws('select * from public.staff_access_requests', '42501', 'not with select * either');
select tests.throws(format($q$update public.profiles set active = true where id = %L$q$, tests.uid('viewer_a')), '42501',
  'a hospital admin cannot activate an account whose email is not confirmed');
select tests.eq(tests.rows(format($q$update public.profiles set name = 'Renamed' where id = %L$q$, tests.uid('viewer_a'))), 1,
  'other edits of that account are still allowed');
select tests.eq(tests.rows(format($q$update public.profiles set active = true where id = %L$q$, tests.uid('dept_a'))), 1,
  'and activating an ordinary account is unchanged');

select tests.service();
update public.staff_access_requests set status = 'PENDING' where user_id = tests.uid('viewer_a');
select tests.login('admin_a');
select tests.eq(tests.rows(format($q$update public.profiles set active = true where id = %L$q$, tests.uid('viewer_a'))), 1,
  'once the email is confirmed the admin activates it');

-- Trial lock on Storage -------------------------------------------------------------------------
reset role;
insert into storage.buckets (id, name, public) values ('surgitrack-assets', 'surgitrack-assets', false) on conflict (id) do nothing;
grant select, insert, update, delete on storage.objects to authenticated;
update public.organizations set plan = 'TRIAL', trial_ends_at = now() - interval '1 day' where id = tests.org('A');
select tests.login('ster_a');
select tests.throws(format($q$insert into storage.objects (bucket_id, name) values ('surgitrack-assets', '%s/sets/a.jpg')$q$,
  tests.org('A')), '42501', 'a hospital whose trial ended uploads nothing');
select tests.login('ster_b');
select tests.eq(tests.rows(format($q$insert into storage.objects (bucket_id, name) values ('surgitrack-assets', '%s/sets/b.jpg')$q$,
  tests.org('B'))), 1, 'other hospitals upload as before');
reset role;
update public.organizations set plan = 'STANDARD', trial_ends_at = null where id = tests.org('A');
select tests.login('ster_a');
select tests.eq(tests.rows(format($q$insert into storage.objects (bucket_id, name) values ('surgitrack-assets', '%s/sets/a.jpg')$q$,
  tests.org('A'))), 1, 'and the hospital uploads again once the trial is extended');

-- profile_contacts() ---------------------------------------------------------------------------
select tests.login('dept_a');
select tests.eq(tests.count('select * from public.profile_contacts()'), 1, 'a department user gets only their own contact');
select tests.eq((select email from public.profile_contacts()), 'dept_a@test.local', 'their own email');
select tests.eq(tests.count(format('select * from public.profile_contacts(%L)', tests.org('A'))), 1, 'also naming their hospital');
select tests.login('admin_a');
select tests.eq(tests.count(format('select * from public.profile_contacts(%L)', tests.org('A'))), 5, 'an admin gets their hospital''s');
select tests.eq(tests.count(format('select * from public.profile_contacts(%L)', tests.org('B'))), 0,
  'and nothing of another hospital');
select tests.login('platform');
select tests.eq(tests.count('select * from public.profile_contacts()'), 8, 'the platform owner gets everyone''s');
select tests.anon();
select tests.throws('select * from public.profile_contacts()', '42501', 'signed-out visitors get nothing');

-- Another admin's account: the platform owner only ------------------------------------------------------
reset role;
update public.profiles set role = 'ADMIN' where id = tests.uid('ster_a');   -- a second admin in hospital A
select tests.login('admin_a');
select tests.eq(tests.rows(format($q$update public.profiles set name = 'Changed' where id = %L$q$, tests.uid('ster_a'))), 0,
  'a hospital admin changes no other admin''s account directly');
select tests.eq(tests.rows(format($q$delete from public.profiles where id = %L$q$, tests.uid('ster_a'))), 0,
  'nor removes it');
select tests.eq(tests.rows(format($q$update public.profiles set name = 'Changed' where id = %L$q$, tests.uid('sup_a'))), 1,
  'but still manages everyone else');
select tests.login('platform');
select tests.eq(tests.rows(format($q$update public.profiles set name = 'By owner' where id = %L$q$, tests.uid('ster_a'))), 1,
  'the platform owner changes it');
select tests.service();
select tests.eq(tests.rows(format($q$update public.profiles set name = 'By function' where id = %L$q$, tests.uid('ster_a'))), 1,
  'and the staff functions (service role) are not limited by the policy');

-- Seats left in a Demo: only for the caller's own hospital -------------------------------------------------------
reset role;
insert into public.demo_accounts (organization_id, hospital_name, contact_name, contact_email, max_extra_users)
values (tests.org('A'), 'Demo A', 'Contact', 'contact@test.local', 10);
select tests.login('admin_a');
select tests.ok(public.demo_seats_left(tests.org('A')) is not null, 'a person reads the seats left of their own Demo');
select tests.ok(public.demo_seats_left(tests.org('B')) is null, 'but not of another hospital, even a real one');
select tests.ok(public.demo_seats_left(md5('no such hospital')::uuid) is null, 'the answer for an unknown id is the same (null)');
select tests.login('admin_b');
select tests.ok(public.demo_seats_left(tests.org('A')) is null, 'another hospital''s admin cannot read hospital A''s seats');
select tests.login('platform');
select tests.ok(public.demo_seats_left(tests.org('A')) is not null, 'the platform owner reads any Demo');
select tests.service();
select tests.ok(public.demo_seats_left(tests.org('A')) is not null, 'the service role (invite-staff) reads any Demo');
select tests.eq(public.demo_seats_left(tests.org('A')), (select max_extra_users from public.demo_accounts where organization_id = tests.org('A'))
  - (select count(*)::int from public.profiles where organization_id = tests.org('A')), 'and the number is the limit less the accounts');

rollback;
