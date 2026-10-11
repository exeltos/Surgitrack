-- A department user changes only their own department's equipment, and every movement names who wrote it.
--
-- 1. The department guards (20261008120000_department_update_guard.sql) limited which fields a department user
--    may change, not whose Set or instrument it is: a direct API call could dispatch, count or add a use to
--    another department's equipment in the same hospital. Now an update from a department user to a Set or an
--    instrument of another department (or of none, e.g. Stock) keeps every saved value, like the other
--    changes such a user may not make (kept, not refused, so a device's batch sync still goes through).
--    The caller's department is read from their own profile, so the guards now run with their owner's rights;
--    they are trigger functions, which no one can call directly (execute stays revoked).
-- 2. movements.created_by defaulted to the writer but could be set to anyone: it is now always the signed-in
--    user who wrote the row (imports and restores by the service role, with no user, keep what they bring).

create or replace function public.caller_department_name_internal() returns text
language sql stable security definer set search_path = public as $fn$
  select d.name from public.profiles p join public.departments d on d.id = p.department_id
   where p.id = auth.uid() and p.active
$fn$;
revoke all on function public.caller_department_name_internal() from public, anon, authenticated;

create or replace function public.department_guard_set() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  r public.instrument_sets%rowtype;
begin
  if public.is_platform_admin() or public."current_role"() is distinct from 'DEPARTMENT' then
    return new;
  end if;
  -- Not this user's department: nothing changes.
  if old.department is distinct from public.caller_department_name_internal() then
    return old;
  end if;
  r := old;
  if new.state = 'PENDING_STERILIZATION' and old.state = 'IN_DEPARTMENT' then
    r.state := new.state;
    r.extra := nullif(coalesce(old.extra, '{}'::jsonb) - 'sterileUntil' - 'sterilizedOn' - 'sterilizedTime', '{}'::jsonb);
  end if;
  if new.uses = coalesce(old.uses, 0) + 1 and old.state in ('IN_DEPARTMENT', 'PENDING_STERILIZATION') then
    r.uses := new.uses;
  end if;
  if new.actual between 0 and greatest(coalesce(old.expected, 0), coalesce(old.actual, 0)) then
    r.actual := new.actual;
  end if;
  r.patient_code := new.patient_code;
  r.updated_at := new.updated_at;
  r.updated_by := new.updated_by;
  return r;
end $fn$;

create or replace function public.department_guard_instrument() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  r public.instruments%rowtype;
  stripped jsonb := nullif(coalesce(old.extra, '{}'::jsonb) - 'sterileUntil' - 'sterilizedOn' - 'sterilizedTime', '{}'::jsonb);
begin
  if public.is_platform_admin() or public."current_role"() is distinct from 'DEPARTMENT' then
    return new;
  end if;
  -- Not this user's department: nothing changes.
  if old.department is distinct from public.caller_department_name_internal() then
    return old;
  end if;
  r := old;
  if new.state = 'PENDING_STERILIZATION' and old.state = 'IN_DEPARTMENT' then
    r.state := new.state;
    r.extra := stripped;
  elsif new.state = 'RETIRED' and old.state in ('IN_DEPARTMENT', 'PENDING_STERILIZATION')
    and old.max_uses is not null and new.uses >= old.max_uses and new.uses <= coalesce(old.uses, 0) + 1 then
    r.state := new.state;
    r.extra := stripped;
    r.retired_at := new.retired_at;
    r.retired_reason := new.retired_reason;
    r.set_id := null;
  end if;
  if old.max_uses is not null and new.uses = coalesce(old.uses, 0) + 1
    and old.state in ('IN_DEPARTMENT', 'PENDING_STERILIZATION') then
    r.uses := new.uses;
  end if;
  r.updated_at := new.updated_at;
  r.updated_by := new.updated_by;
  return r;
end $fn$;
revoke all on function public.department_guard_set() from public, anon, authenticated;
revoke all on function public.department_guard_instrument() from public, anon, authenticated;

-- 2 -----------------------------------------------------------------------------------------------
create or replace function public.movement_writer() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $fn$;
revoke all on function public.movement_writer() from public, anon, authenticated;
create trigger movements_writer before insert on public.movements
  for each row execute function public.movement_writer();
