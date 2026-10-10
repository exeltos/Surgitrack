-- Who a person is must not be quietly changeable by someone else, because every handover signature and
-- history entry rests on it.
--
-- 1. The sign-in email and the username (user code) of an account change only through the staff
--    functions, never by a direct write to the table. login-with-code and verify-handover sign in with
--    profiles.email, so an admin who rewrote it straight in the table could sign in as that person with
--    their own password. update-staff changes both the sign-in account and the profile, and records it.
-- 2. account_events: what was done to an account by someone else (a set-password or invitation link made
--    for it, its sign-in email changed). Written by the staff functions with the service role; the
--    hospital's admins and the platform owner read it; nobody signed in changes or removes an entry.
-- 3. The platform owner's account: made or claimed only with a confirmed email, and only while no other
--    platform owner exists, so registering that address again can never hand over the platform.

-- 1 -----------------------------------------------------------------------------------------------
create or replace function public.profiles_identity_guard() returns trigger language plpgsql
  set search_path = public as $$
begin
  -- A direct write through the API runs as `authenticated`; the staff functions (service role) and the
  -- security definer functions run as other roles and are not limited here.
  if current_user = 'authenticated'
     and (new.email is distinct from old.email or new.user_code is distinct from old.user_code) then
    raise exception 'The sign-in email and the username change only through the staff functions'
      using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.profiles_identity_guard() from public, anon, authenticated;

drop trigger if exists profiles_identity_guard on public.profiles;
create trigger profiles_identity_guard before update on public.profiles
  for each row execute function public.profiles_identity_guard();

-- 2 -----------------------------------------------------------------------------------------------
create table if not exists public.account_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  target_id uuid references auth.users(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('password_link', 'invite_link', 'email_changed')),
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists account_events_org_time_idx on public.account_events (organization_id, at desc);
create index if not exists account_events_target_idx on public.account_events (target_id);
create index if not exists account_events_actor_idx on public.account_events (actor_id);
alter table public.account_events enable row level security;

drop policy if exists account_events_read on public.account_events;
create policy account_events_read on public.account_events for select to authenticated
  using ((organization_id = (select public.current_org_id()) and (select public."current_role"()) = 'ADMIN')
    or (select public.is_platform_admin()));

revoke all on public.account_events from public, anon, authenticated;
grant select on public.account_events to authenticated;
grant all on public.account_events to service_role;

-- 3 -----------------------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if lower(new.email) = 'info@exeltos.com'
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
declare p public.profiles;
begin
  if auth.uid() is null
     or lower(coalesce(auth.jwt()->>'email', '')) <> 'info@exeltos.com'
     or not exists (select 1 from auth.users u
                     where u.id = auth.uid() and lower(u.email) = 'info@exeltos.com' and u.email_confirmed_at is not null)
     or exists (select 1 from public.profiles where organization_id is null and role = 'ADMIN' and id <> auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.profiles(id,organization_id,department_id,name,email,role,active,demo_enabled)
  values(auth.uid(),null,null,'Platform Admin','info@exeltos.com','ADMIN',true,false)
  on conflict(id) do update set name='Platform Admin',email='info@exeltos.com',role='ADMIN',active=true,organization_id=null,department_id=null
  returning * into p;
  return p;
end $$;
revoke execute on function public.claim_platform_admin() from public, anon;
grant execute on function public.claim_platform_admin() to authenticated;
