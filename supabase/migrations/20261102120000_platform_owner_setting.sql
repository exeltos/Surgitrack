-- The platform owner's email lived in the code of two functions (handle_new_user and claim_platform_admin) and in
-- the app. It now lives in one private row, platform_owner, which only the database functions read; nobody signed in
-- can read or write it. The app asks caller_is_platform_owner() instead of comparing the email itself.
-- Seeded with the address that was hard-coded, so nothing changes today.
--
-- To hand the platform over to another person (run as postgres, in this order):
--   1. update public.profiles set role = 'VIEWER', organization_id = <a hospital>, ... for the old owner, or delete
--      that account: claim_platform_admin refuses while another platform admin exists;
--   2. update public.platform_owner set email = 'new.owner@example.com';
--   3. the new owner signs up or signs in with that (confirmed) address and is made the platform admin.
create table if not exists public.platform_owner (
  singleton boolean primary key default true check (singleton),
  email text not null check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  changed_at timestamptz not null default now()
);
alter table public.platform_owner enable row level security;
-- No policy and no grant for signed-in people: only the functions below (owner rights) and the service role.
revoke all on public.platform_owner from public, anon, authenticated;
grant all on public.platform_owner to service_role;
insert into public.platform_owner (email) values ('info@exeltos.com') on conflict (singleton) do nothing;

-- A new sign-in account with the owner's confirmed address becomes the platform admin (while there is none).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if lower(new.email) = (select o.email from public.platform_owner o)
     and new.email_confirmed_at is not null
     and not exists (select 1 from public.profiles where organization_id is null and role = 'ADMIN' and id <> new.id) then
    insert into public.profiles(id, organization_id, department_id, name, email, role, active, demo_enabled)
    values(new.id, null, null, 'Platform Admin', lower(new.email), 'ADMIN', true, false)
    on conflict(id) do update set name=excluded.name,email=excluded.email,role='ADMIN',active=true,organization_id=null,department_id=null;
  end if;
  return new;
end;
$$;

create or replace function public.claim_platform_admin()
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare p public.profiles; v_email text;
begin
  select o.email into v_email from public.platform_owner o;
  if auth.uid() is null
     or v_email is null
     or lower(coalesce(auth.jwt()->>'email', '')) <> v_email
     or not exists (select 1 from auth.users u
                     where u.id = auth.uid() and lower(u.email) = v_email and u.email_confirmed_at is not null)
     or exists (select 1 from public.profiles where organization_id is null and role = 'ADMIN' and id <> auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.profiles(id,organization_id,department_id,name,email,role,active,demo_enabled)
  values(auth.uid(),null,null,'Platform Admin',v_email,'ADMIN',true,false)
  on conflict(id) do update set name='Platform Admin',email=v_email,role='ADMIN',active=true,organization_id=null,department_id=null
  returning * into p;
  return p;
end $$;
revoke execute on function public.claim_platform_admin() from public, anon;
grant execute on function public.claim_platform_admin() to authenticated;

-- Is the signed-in person the platform owner (their confirmed sign-in email is the owner's)? The app asks this
-- instead of knowing the address. It tells a person only about themselves.
create or replace function public.caller_is_platform_owner()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from auth.users u, public.platform_owner o
     where u.id = auth.uid() and lower(u.email) = o.email and u.email_confirmed_at is not null)
$$;
revoke execute on function public.caller_is_platform_owner() from public, anon;
grant execute on function public.caller_is_platform_owner() to authenticated;
