-- Shared helpers and sample data for the SQL tests in supabase/tests/sql. Each test file includes
-- this inside its own transaction and rolls back at the end, so the tests never see each other's data.
-- Runs as `postgres` (bypasses row level security, like the migrations).

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Deterministic ids, so tests can name people and hospitals.
create function tests.uid(p_name text) returns uuid language sql immutable as $$ select md5('user:' || p_name)::uuid $$;
create function tests.org(p_name text) returns uuid language sql immutable as $$ select md5('org:' || p_name)::uuid $$;

-- Act as a signed-in user (PostgREST: role authenticated + the JWT claims), signed out, or the service role.
create function tests.login(p_name text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.uid(p_name), 'role', 'authenticated', 'email', p_name || '@test.local')::text, true);
end $$;
create function tests.anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;
create function tests.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end $$;

-- Assertions: a failed one raises, which fails the file; a passed one prints a NOTICE.
create function tests.ok(p_ok boolean, p_what text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'not ok - %', p_what;
  end if;
  raise notice 'ok - %', p_what;
end $$;
create function tests.eq(p_got anyelement, p_want anyelement, p_what text) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'not ok - % (got %, want %)', p_what, p_got, p_want;
  end if;
  raise notice 'ok - %', p_what;
end $$;
-- Runs a statement as the current role and returns how many rows it touched.
create function tests.rows(p_sql text) returns integer language plpgsql as $$
declare
  n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
-- How many rows a query returns, as the current role.
create function tests.count(p_sql text) returns integer language plpgsql as $$
declare
  n integer;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
end $$;
-- The statement must fail (with this SQLSTATE when given).
create function tests.throws(p_sql text, p_state text, p_what text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_state is not null and sqlstate <> p_state then
      raise exception 'not ok - % (failed with % %, want %)', p_what, sqlstate, sqlerrm, p_state;
    end if;
    raise notice 'ok - %', p_what;
    return;
  end;
  raise exception 'not ok - % (did not fail)', p_what;
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Two hospitals. A: an admin, a Sterilization supervisor, a Sterilization user, a department user and a
-- viewer. B: an admin and a Sterilization user. And the platform owner.
insert into public.organizations (id, name, code) values
  (tests.org('A'), 'Hospital A', 'TEST-A'),
  (tests.org('B'), 'Hospital B', 'TEST-B');
insert into public.departments (organization_id, name, code) values
  (tests.org('A'), 'Theatre', 'OR'), (tests.org('B'), 'Theatre', 'OR');

insert into auth.users (id, email)
select tests.uid(n), n || '@test.local'
  from unnest(array['platform','admin_a','sup_a','ster_a','dept_a','viewer_a','admin_b','ster_b']) n;
insert into public.profiles (id, organization_id, department_id, name, email, role, supervisor)
select tests.uid(p.n), case when p.o is null then null else tests.org(p.o) end,
       (select d.id from public.departments d where d.organization_id = tests.org(p.o) and p.r = 'DEPARTMENT'),
       initcap(replace(p.n, '_', ' ')), p.n || '@test.local', p.r::public.surgi_role, p.s
  from (values
    ('platform', null, 'ADMIN', false),
    ('admin_a', 'A', 'ADMIN', false),
    ('sup_a', 'A', 'STERILIZATION', true),
    ('ster_a', 'A', 'STERILIZATION', false),
    ('dept_a', 'A', 'DEPARTMENT', false),
    ('viewer_a', 'A', 'VIEWER', false),
    ('admin_b', 'B', 'ADMIN', false),
    ('ster_b', 'B', 'STERILIZATION', false)
  ) as p(n, o, r, s);

-- The settings row of each hospital (Studio libraries, role settings and the history arrays).
insert into public.hospital_settings (organization_id, id, configuration_audit, role_permission_audit, workflow_versions)
values
  (tests.org('A'), 'state', '[{"id":"cfg-1","entityType":"LIBRARY","entityId":"x","action":"UPDATE","at":"2026-10-01T10:00:00Z","by":"Admin"}]', '[]', '[]'),
  (tests.org('B'), 'state', '[]', '[]', '[]');

-- Hospital A: a Set with one instrument, a Stock instrument and one in Service. Hospital B: a Set.
insert into public.instrument_sets (organization_id, id, barcode, code, name, department, state, expected, actual, composition_template)
values
  (tests.org('A'), 'set-a1', 'S000001', 'LAP', 'Laparoscopy', 'Theatre', 'IN_DEPARTMENT', 1, 1, '[{"code":"T1","quantity":1}]'),
  (tests.org('A'), 'set-a2', 'S000002', 'ORT', 'Orthopaedic', 'Theatre', 'IN_DEPARTMENT', 0, 0, null),
  (tests.org('B'), 'set-b1', 'S000001', 'LAP', 'Laparoscopy B', 'Theatre', 'IN_DEPARTMENT', 0, 0, null);
insert into public.instruments (organization_id, id, barcode, code, name, department, mode, set_id, state, max_uses)
values
  (tests.org('A'), 'tool-a1', 'T000001', 'T1', 'Scissors', 'Theatre', 'SET_MEMBER', 'set-a1', 'IN_DEPARTMENT', null),
  (tests.org('A'), 'tool-a2', 'T000002', 'T1', 'Scissors', null, 'STOCK', null, 'IN_STOCK', null),
  (tests.org('A'), 'tool-a3', 'T000003', 'T2', 'Forceps', 'Service', 'STANDALONE', null, 'SERVICE', null),
  (tests.org('B'), 'tool-b1', 'T000001', 'T1', 'Scissors B', null, 'STOCK', null, 'IN_STOCK', null);
