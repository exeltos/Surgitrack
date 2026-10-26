-- The department cancels its own dispatch sent by mistake, while Sterilization has not received it.
--
-- The app keeps what each dispatch, receipt and delivery changed, so that one made by mistake can be undone
-- (src/core/movementUndo.ts). The hospital admin and the Sterilization supervisor may change Sets and
-- instruments freely, and a Sterilization user may move them back a step; a department user is held by the
-- department guards (20261014063143_department_pickup.sql), which only let them send to Sterilization and
-- pick up from it. Here they also let them take back their own dispatch:
--
-- 1. At the dispatch (IN_DEPARTMENT → PENDING_STERILIZATION) the sterile dates are taken off as before, and
--    kept aside in extra.dispatchedSterile.
-- 2. A department user may move their own Set or instrument from PENDING_STERILIZATION back to IN_DEPARTMENT
--    (a later step, e.g. once Sterilization received it, is not PENDING_STERILIZATION any more). The sterile
--    dates come back from what the dispatch kept aside, never from the device.
-- A use counted by the dispatch stays counted (usage_never_decreases): the app leaves such a dispatch to the
-- supervisor. Every other change stays as before.

create or replace function public.department_guard_set() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  r public.instrument_sets%rowtype;
  base jsonb := coalesce(old.extra, '{}'::jsonb);
  sterile jsonb := jsonb_strip_nulls(jsonb_build_object(
    'sterileUntil', base->'sterileUntil', 'sterilizedOn', base->'sterilizedOn', 'sterilizedTime', base->'sterilizedTime'));
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
    r.extra := nullif(
      (base - 'sterileUntil' - 'sterilizedOn' - 'sterilizedTime' - 'dispatchedSterile')
        || case when sterile = '{}'::jsonb then '{}'::jsonb else jsonb_build_object('dispatchedSterile', sterile) end,
      '{}'::jsonb);
  elsif new.state = 'IN_DEPARTMENT' and old.state = 'PENDING_STERILIZATION' then
    -- Its dispatch taken back: the sterile dates it had come back.
    r.state := new.state;
    r.extra := nullif((base - 'dispatchedSterile') || coalesce(base->'dispatchedSterile', '{}'::jsonb), '{}'::jsonb);
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
  base jsonb := coalesce(old.extra, '{}'::jsonb);
  stripped jsonb := nullif(coalesce(old.extra, '{}'::jsonb) - 'sterileUntil' - 'sterilizedOn' - 'sterilizedTime', '{}'::jsonb);
  sterile jsonb := jsonb_strip_nulls(jsonb_build_object(
    'sterileUntil', base->'sterileUntil', 'sterilizedOn', base->'sterilizedOn', 'sterilizedTime', base->'sterilizedTime'));
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
    r.extra := nullif(
      (base - 'sterileUntil' - 'sterilizedOn' - 'sterilizedTime' - 'dispatchedSterile')
        || case when sterile = '{}'::jsonb then '{}'::jsonb else jsonb_build_object('dispatchedSterile', sterile) end,
      '{}'::jsonb);
  elsif new.state = 'IN_DEPARTMENT' and old.state = 'PENDING_STERILIZATION' then
    -- Its dispatch taken back: the sterile dates it had come back.
    r.state := new.state;
    r.extra := nullif((base - 'dispatchedSterile') || coalesce(base->'dispatchedSterile', '{}'::jsonb), '{}'::jsonb);
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
