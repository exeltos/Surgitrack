-- The department records the pickup of sterile Sets and instruments brought from Sterilization (the phone app).
--
-- Until now only Sterilization recorded a delivery to a department: its user delivered, and the department
-- person signed with their code and password. The phone app also lets the department record it from its side:
-- the department user receives, and the Sterilization person who brought the items signs on the same phone.
--
-- 1. deliveries: a department user may insert a delivery only as its receiver, for their own department.
--    (deliveries_insert keeps Sterilization's rule and adds this one.) The signature is checked as for every delivery (handover_counterparty_stamp): the record is verified only
--    when the person named as delivering signed for these items, for this user.
-- 2. The department guards let a department user move their own Set or instrument from «Έτοιμο για παραλαβή»
--    (READY_FOR_PICKUP) to «Στο τμήμα» (IN_DEPARTMENT), keeping its sterile dates. Every other change stays as
--    before (20261011170000_department_own_equipment.sql).

-- 1 -----------------------------------------------------------------------------------------------
-- The signed-in user's own department name, for the policy below (only their own, so callable by them).
create or replace function public.caller_department_name() returns text
language sql stable security definer set search_path = public as $fn$
  select public.caller_department_name_internal()
$fn$;
revoke all on function public.caller_department_name() from public, anon;
grant execute on function public.caller_department_name() to authenticated;

-- One insert rule per table: Sterilization (and the admins) as before, or a department user's own pickup.
alter policy deliveries_insert on public.deliveries with check (
  ((organization_id = (select public.current_org_id())) or (select public.is_platform_admin()))
  and (
    (select public.app_record_writable('deliveries'::text))
    or (
      organization_id = (select public.current_org_id())
      and (select public."current_role"()) = 'DEPARTMENT'
      and received_by_user_id = (select auth.uid())::text
      and department = (select public.caller_department_name())
    )
  )
);

-- 2 -----------------------------------------------------------------------------------------------
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
  elsif new.state = 'IN_DEPARTMENT' and old.state = 'READY_FOR_PICKUP' then
    -- Picked up from Sterilization: still sterile, so its sterile dates stay.
    r.state := new.state;
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
  elsif new.state = 'IN_DEPARTMENT' and old.state = 'READY_FOR_PICKUP' then
    -- Picked up from Sterilization: still sterile, so its sterile dates stay.
    r.state := new.state;
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
