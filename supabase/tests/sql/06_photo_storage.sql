-- Photos in Storage: each hospital's folder is its own; department users upload only problem-report photos
-- (issues/), Sterilization uploads anywhere in its hospital, viewers upload nothing.
begin;
\ir ../local/fixtures.sql

-- As on the platform: the bucket exists and signed-in users have table rights; the policies decide.
insert into storage.buckets (id, name, public) values ('surgitrack-assets', 'surgitrack-assets', false)
  on conflict (id) do nothing;
grant select, insert, update, delete on storage.objects to authenticated;

-- The statement that uploads a file at this path (built as postgres, run as the signed-in user).
create function tests.upload(p_path text) returns text language sql immutable as $$
  select format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'surgitrack-assets', p_path)
$$;
grant execute on function tests.upload(text) to authenticated;

select tests.login('ster_a');
select tests.eq(tests.rows(tests.upload(tests.org('A') || '/assets/p1.jpg')), 1,
  'Sterilization uploads a Set or instrument photo in its hospital');
select tests.throws(tests.upload(tests.org('B') || '/assets/p2.jpg'), '42501',
  'Sterilization uploads nothing into another hospital');

select tests.login('dept_a');
select tests.eq(tests.rows(tests.upload(tests.org('A') || '/issues/p3.jpg')), 1,
  'a department user uploads a problem-report photo');
select tests.throws(tests.upload(tests.org('A') || '/assets/p4.jpg'), '42501',
  'a department user uploads no Set or instrument photo');
select tests.throws(tests.upload(tests.org('B') || '/issues/p5.jpg'), '42501',
  'a department user uploads nothing into another hospital');

select tests.login('viewer_a');
select tests.throws(tests.upload(tests.org('A') || '/issues/p6.jpg'), '42501', 'a viewer uploads nothing');

select tests.login('admin_b');
select tests.eq(tests.count($$select 1 from storage.objects where bucket_id = 'surgitrack-assets'$$), 0,
  'hospital B sees none of hospital A''s photos');
select tests.login('dept_a');
select tests.eq(tests.count($$select 1 from storage.objects where bucket_id = 'surgitrack-assets'$$), 2,
  'hospital A''s users see its photos');

rollback;
