-- Bulk staff import by the platform owner (edge function import-staff): the people it creates have an initial
-- password (their mobile number) that they must replace at their first sign-in, within a deadline.
--
-- A person whose password_change_required is set:
--  * is held to it by the DATABASE, not by the screen: current_org_id(), current_role() and
--    caller_department_name_internal() answer nothing for them, so every row-level policy of the hospital's
--    data (all of them are written with these) shows them nothing, in the app or by calling the API directly.
--    They can still read their own profile (to know why) and call change-initial-password.
--  * is locked (active = false) by the nightly job lock_unchanged_passwords() when the deadline passes and the
--    password was never changed; an admin who activates the account again (update-staff) gives it a new deadline.
-- Nobody signed in can set or clear the flag or the deadline with a direct write: only the staff functions can.
alter table public.profiles
  add column if not exists password_change_required boolean not null default false,
  add column if not exists password_change_deadline timestamptz;
-- A column added to profiles is not readable by signed-in users until it is granted (20261101210816).
grant select (password_change_required, password_change_deadline) on public.profiles to authenticated;

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
  if current_user = 'authenticated'
     and (new.password_change_required is distinct from old.password_change_required
          or new.password_change_deadline is distinct from old.password_change_deadline) then
    raise exception 'The first-password requirement changes only through the staff functions'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.current_org_id() returns uuid language sql stable security definer set search_path=public as $$
 select organization_id from public.profiles where id=auth.uid() and active=true and not password_change_required
$$;
create or replace function public.current_role() returns public.surgi_role language sql stable security definer set search_path=public as $$
 select role from public.profiles where id=auth.uid() and active=true and not password_change_required
$$;
create or replace function public.caller_department_name_internal() returns text language sql stable security definer
  set search_path = public as $$
  select d.name from public.profiles p join public.departments d on d.id = p.department_id
   where p.id = auth.uid() and p.active and not p.password_change_required
$$;

-- Nightly: an account whose deadline passed without a password change is locked.
create or replace function public.lock_unchanged_passwords() returns int language sql security definer
  set search_path = public as $$
  with locked as (
    update public.profiles set active = false
     where password_change_required and active
       and password_change_deadline is not null and password_change_deadline < now()
    returning 1)
  select count(*)::int from locked
$$;
revoke execute on function public.lock_unchanged_passwords() from public, anon, authenticated;
select cron.schedule('lock-unchanged-passwords', '51 2 * * *', $$select public.lock_unchanged_passwords();$$);

-- The audit trail records an import (and the first password change is told to nobody: it is the person's own).
alter table public.account_events drop constraint if exists account_events_action_check;
alter table public.account_events add constraint account_events_action_check
  check (action in ('password_link', 'invite_link', 'email_changed', 'email_change_requested', 'staff_imported'));
