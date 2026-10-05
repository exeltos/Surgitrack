-- Hospital self-signup: each hospital shares its own 10-day signup link; staff register, confirm
-- their email, pick their department, and the hospital admin approves them with a role.

create or replace function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.is_platform_admin()
      or (p_org is not null and p_org = public.current_org_id() and public."current_role"() = 'ADMIN')
$$;
revoke execute on function public.is_org_admin(uuid) from public, anon;
grant execute on function public.is_org_admin(uuid) to authenticated;

create table if not exists public.signup_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists signup_links_org_idx on public.signup_links(organization_id, created_at desc);
create index if not exists signup_links_created_by_idx on public.signup_links(created_by);
alter table public.signup_links enable row level security;
create policy signup_links_read on public.signup_links for select to authenticated
  using (public.is_org_admin(organization_id));

create table if not exists public.staff_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  signup_link_id uuid references public.signup_links(id) on delete set null,
  full_name text not null,
  email text not null,
  status text not null default 'PENDING_EMAIL' check (status in ('PENDING_EMAIL','PENDING','APPROVED','REJECTED')),
  requested_at timestamptz not null default now(),
  email_confirmed_at timestamptz,
  admin_notified_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  granted_role public.surgi_role,
  decision_note text,
  decision_notified_at timestamptz
);
create index if not exists staff_access_requests_org_idx on public.staff_access_requests(organization_id, status);
create index if not exists staff_access_requests_department_idx on public.staff_access_requests(department_id);
create index if not exists staff_access_requests_link_idx on public.staff_access_requests(signup_link_id);
create index if not exists staff_access_requests_decided_by_idx on public.staff_access_requests(decided_by);
alter table public.staff_access_requests enable row level security;
-- Applicants see their own request; hospital admins see their hospital's. Writes go through functions.
create policy staff_access_requests_read on public.staff_access_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_admin(organization_id));

-- A new link replaces any active one, so an old link stops working as soon as it is renewed.
create or replace function public.hospital_create_signup_link(p_org uuid)
returns table(token text, expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_token text := encode(gen_random_bytes(18), 'hex');
begin
  if not public.is_org_admin(p_org) then raise exception 'forbidden'; end if;
  if exists (select 1 from public.organizations o where o.id = p_org and o.is_demo) then
    raise exception 'demo hospitals have no signup link';
  end if;
  update public.signup_links set revoked_at = now()
   where organization_id = p_org and revoked_at is null and signup_links.expires_at > now();
  insert into public.signup_links(organization_id, token, expires_at, created_by)
  values (p_org, v_token, now() + interval '10 days', auth.uid());
  return query select v_token, now() + interval '10 days';
end $$;
revoke execute on function public.hospital_create_signup_link(uuid) from public, anon;
grant execute on function public.hospital_create_signup_link(uuid) to authenticated;

create or replace function public.hospital_revoke_signup_links(p_org uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_org_admin(p_org) then raise exception 'forbidden'; end if;
  update public.signup_links set revoked_at = now() where organization_id = p_org and revoked_at is null;
end $$;
revoke execute on function public.hospital_revoke_signup_links(uuid) from public, anon;
grant execute on function public.hospital_revoke_signup_links(uuid) to authenticated;

-- What the public signup page needs: the hospital's name and its active departments. Nothing else.
create or replace function public.signup_link_info(p_token text) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'organization_name', o.name,
    'expires_at', l.expires_at,
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'code', d.code) order by d.name)
        from public.departments d where d.organization_id = o.id and d.active), '[]'::jsonb))
  from public.signup_links l
  join public.organizations o on o.id = l.organization_id
  where l.token = p_token and l.revoked_at is null and l.expires_at > now() and o.active and not o.is_demo
$$;
revoke execute on function public.signup_link_info(text) from public;
grant execute on function public.signup_link_info(text) to anon, authenticated;

-- Confirming the email moves the request to the hospital admin's queue.
create or replace function public.staff_request_email_confirmed() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.staff_access_requests
       set status = 'PENDING', email_confirmed_at = new.email_confirmed_at
     where user_id = new.id and status = 'PENDING_EMAIL';
  end if;
  return new;
end $$;
revoke execute on function public.staff_request_email_confirmed() from public, anon, authenticated;
drop trigger if exists surgitrack_staff_request_confirmed on auth.users;
create trigger surgitrack_staff_request_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.staff_request_email_confirmed();

-- Approve (creating the user's profile with the role and department the admin chose) or reject.
create or replace function public.hospital_decide_access_request(
  p_request uuid, p_approve boolean, p_role public.surgi_role default null,
  p_department uuid default null, p_note text default null
) returns void
language plpgsql security definer set search_path=public as $$
declare r public.staff_access_requests; v_department uuid;
begin
  select * into r from public.staff_access_requests where id = p_request for update;
  if r.id is null then raise exception 'request not found'; end if;
  if not public.is_org_admin(r.organization_id) then raise exception 'forbidden'; end if;
  if r.status <> 'PENDING' then raise exception 'request is not awaiting approval'; end if;
  if p_approve then
    if p_role is null then raise exception 'role required'; end if;
    v_department := coalesce(p_department, r.department_id);
    if v_department is not null and not exists (
      select 1 from public.departments d where d.id = v_department and d.organization_id = r.organization_id
    ) then raise exception 'department not in this hospital'; end if;
    insert into public.profiles(id, organization_id, department_id, name, email, role, active, demo_enabled)
    values (r.user_id, r.organization_id, v_department, r.full_name, r.email, p_role, true, false)
    on conflict (id) do update set organization_id = excluded.organization_id, department_id = excluded.department_id,
      name = excluded.name, email = excluded.email, role = excluded.role, active = true, updated_at = now();
    update public.staff_access_requests
       set status = 'APPROVED', granted_role = p_role, department_id = v_department,
           decided_at = now(), decided_by = auth.uid(), decision_note = nullif(trim(p_note), '')
     where id = r.id;
  else
    update public.staff_access_requests
       set status = 'REJECTED', decided_at = now(), decided_by = auth.uid(), decision_note = nullif(trim(p_note), '')
     where id = r.id;
  end if;
end $$;
revoke execute on function public.hospital_decide_access_request(uuid, boolean, public.surgi_role, uuid, text) from public, anon;
grant execute on function public.hospital_decide_access_request(uuid, boolean, public.surgi_role, uuid, text) to authenticated;
