-- A department user may update a Set or an instrument only the way its own workflow does:
--   dispatch to Sterilization (In department → Pending sterilization, the sterile dates go with it),
--   +1 use on limited-use items, out of use when the limit is reached,
--   the surgical count (instruments present, patient code).
-- Anything else such a user sends keeps its saved value. Changes are kept, not refused, so a device
-- with an older picture of a Set still dispatches it, and takes the saved values at its next sync.
-- Issues: a department user only reports them; an update from such a user changes nothing.

create or replace function public.department_guard_set() returns trigger
language plpgsql set search_path = public as $fn$
declare
  r public.instrument_sets%rowtype;
begin
  if public.is_platform_admin() or public."current_role"() is distinct from 'DEPARTMENT' then
    return new;
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
language plpgsql set search_path = public as $fn$
declare
  r public.instruments%rowtype;
  stripped jsonb := nullif(coalesce(old.extra, '{}'::jsonb) - 'sterileUntil' - 'sterilizedOn' - 'sterilizedTime', '{}'::jsonb);
begin
  if public.is_platform_admin() or public."current_role"() is distinct from 'DEPARTMENT' then
    return new;
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

create or replace function public.department_guard_issue() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if public.is_platform_admin() or public."current_role"() is distinct from 'DEPARTMENT' then
    return new;
  end if;
  return old;
end $fn$;

-- Named to run before the other BEFORE UPDATE triggers (alphabetical): the update stamp is set after.
drop trigger if exists instrument_sets_department_guard on public.instrument_sets;
create trigger instrument_sets_department_guard before update on public.instrument_sets
  for each row execute function public.department_guard_set();
drop trigger if exists instruments_department_guard on public.instruments;
create trigger instruments_department_guard before update on public.instruments
  for each row execute function public.department_guard_instrument();
drop trigger if exists issues_department_guard on public.issues;
create trigger issues_department_guard before update on public.issues
  for each row execute function public.department_guard_issue();

revoke execute on function public.department_guard_set() from public, anon, authenticated;
revoke execute on function public.department_guard_instrument() from public, anon, authenticated;
revoke execute on function public.department_guard_issue() from public, anon, authenticated;
