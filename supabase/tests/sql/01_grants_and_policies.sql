-- Signed-out visitors (anon) have no access to public tables, sequences or functions except the
-- signup page's signup_link_info; the platform defaults no longer hand anon new objects; no policy
-- applies to {public}; one permissive policy per table, role and action.
begin;
\ir ../local/fixtures.sql

select tests.eq((
  select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
       or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete')
       or has_table_privilege('anon', c.oid, 'truncate') or has_table_privilege('anon', c.oid, 'references')
       or has_table_privilege('anon', c.oid, 'trigger'))), 0,
  'anon has no privilege on any public table');
select tests.eq((
  select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'S'
     and (has_sequence_privilege('anon', c.oid, 'usage') or has_sequence_privilege('anon', c.oid, 'select')
       or has_sequence_privilege('anon', c.oid, 'update'))), 0,
  'anon has no privilege on any public sequence');
select tests.eq((
  select string_agg(p.proname, ',' order by p.proname) from pg_proc p
   where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')),
  'signup_link_info', 'anon executes only signup_link_info');
select tests.eq((
  select count(*)::int from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))), 0,
  'no public function is executable by PUBLIC');
select tests.ok(has_function_privilege('authenticated', 'public.demo_seats_left(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.demo_seats_left(uuid)', 'execute'),
  'demo_seats_left stays callable by authenticated and service_role');
select tests.ok(not has_function_privilege('authenticated', 'public.demo_user_limit()', 'execute'),
  'demo_user_limit (a trigger function) is not callable by signed-in users');

-- New objects made by postgres from now on.
create table public.zz_new_table (id int);
create sequence public.zz_new_seq;
create function public.zz_new_fn() returns int language sql as $$ select 1 $$;
select tests.ok(not has_table_privilege('anon', 'public.zz_new_table', 'select')
  and has_table_privilege('authenticated', 'public.zz_new_table', 'select'),
  'a new table: no anon, authenticated as before');
select tests.ok(not has_sequence_privilege('anon', 'public.zz_new_seq', 'usage'), 'a new sequence: no anon');
select tests.ok(not has_function_privilege('anon', 'public.zz_new_fn()', 'execute')
  and has_function_privilege('authenticated', 'public.zz_new_fn()', 'execute'),
  'a new function: not anon nor PUBLIC, authenticated as before');

select tests.eq((
  select count(*)::int from pg_policies where schemaname = 'public' and 'public' = any (roles)), 0,
  'no policy applies to the {public} role');
select tests.eq((
  select count(*)::int from (
    select tablename, r, c from pg_policies p, unnest(p.roles) r,
      unnest(case p.cmd when 'ALL' then array['SELECT','INSERT','UPDATE','DELETE'] else array[p.cmd] end) c
     where schemaname = 'public' and permissive = 'PERMISSIVE'
     group by 1, 2, 3 having count(*) > 1) d), 0,
  'one permissive policy per table, role and action');

-- Signed out, through the API.
select tests.anon();
select tests.throws('select * from public.instruments', '42501', 'anon cannot read instruments');
select tests.throws('select * from public.deleted_records', '42501', 'anon cannot read deleted_records');
select tests.throws('insert into public.demo_requests (organization_id, kind) values (tests.org(''A''), ''PURCHASE'')',
  '42501', 'anon cannot write demo_requests');
select tests.throws('select public.demo_seats_left(tests.org(''A''))', '42501', 'anon cannot call demo_seats_left');
select tests.ok((select public.signup_link_info('no-such-token')) is not distinct from (select public.signup_link_info('no-such-token')),
  'anon still calls signup_link_info');
reset role;

-- Demo tables: the merged policies keep who sees what.
update public.organizations set is_demo = true, evaluation = true where id = tests.org('A');
insert into public.demo_feedback (organization_id, user_id, topic, rating) values
  (tests.org('A'), tests.uid('admin_a'), 'overview', 4), (tests.org('A'), tests.uid('ster_a'), 'overview', 5);
insert into public.demo_requests (organization_id, user_id, kind) values (tests.org('A'), tests.uid('ster_a'), 'PURCHASE');
select tests.login('admin_a');
select tests.eq(tests.count('select * from public.demo_feedback'), 1, 'a Demo user reads only their own feedback');
select tests.eq(tests.count('select * from public.demo_requests'), 0, 'a Demo user reads only their own requests');
select tests.eq(tests.rows($$insert into public.demo_requests (organization_id, user_id, kind)
  values (tests.org('A'), tests.uid('admin_a'), 'EXTENSION')$$), 1, 'a Demo user sends a request');
select tests.eq(tests.rows('update public.demo_requests set status = ''HANDLED'''), 0,
  'a Demo user cannot handle requests');
select tests.eq(tests.count('select * from public.demo_accounts'), 0, 'no demo_accounts row to read in A (none exists)');
select tests.login('platform');
select tests.eq(tests.count('select * from public.demo_feedback'), 2, 'the platform owner reads all feedback');
select tests.eq(tests.rows('update public.demo_requests set status = ''HANDLED'''), 2,
  'the platform owner handles requests');
reset role;

rollback;
