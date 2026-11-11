-- Instruments of "use with a wear check": no usage limit, but the uses are counted the same way (and an administrator
-- may add the uses already made). The flag is set only by who may set the usage limit; the department's dispatch may
-- count a use on such an instrument exactly as it does on a limited one.
alter table public.instruments add column if not exists wear_check boolean;

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
  if (old.max_uses is not null or coalesce(old.wear_check, false)) and new.uses = coalesce(old.uses, 0) + 1
    and old.state in ('IN_DEPARTMENT', 'PENDING_STERILIZATION') then
    r.uses := new.uses;
  end if;
  r.updated_at := new.updated_at;
  r.updated_by := new.updated_by;
  return r;
end $fn$;

create or replace function public.supervisor_guard_instrument() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  allowed boolean;
begin
  if public."current_role"() is distinct from 'STERILIZATION' or public.is_platform_admin() then
    return new;
  end if;
  if (new.photos is distinct from old.photos or new.image_url is distinct from old.image_url)
    and not public.role_has_permission('asset.photos.manage') then
    new.photos := old.photos;
    new.image_url := old.image_url;
  end if;
  if public.is_asset_manager() then
    return new;
  end if;
  new.barcode := old.barcode;
  new.legacy_barcodes := old.legacy_barcodes;
  new.code := old.code;
  new.name := old.name;
  new.specialty := old.specialty;
  new.manufacturer := old.manufacturer;
  new.serial_number := old.serial_number;
  new.purchase_date := old.purchase_date;
  new.warranty_until := old.warranty_until;
  new.cost := old.cost;
  new.notes := old.notes;
  new.color_mode := old.color_mode;
  new.color_tapes := old.color_tapes;
  new.ownership := old.ownership;
  new.owner_name := old.owner_name;
  new.max_uses := old.max_uses;
  new.wear_check := old.wear_check;
  if new.set_id is distinct from old.set_id or new.mode is distinct from old.mode then
    allowed :=
      -- Out of use at its usage limit: it leaves its Set.
      (new.state = 'RETIRED' and new.set_id is null and new.mode = old.mode)
      or (public.role_has_permission('stock.manage') and (
        -- Replacing from Stock: a Stock instrument goes into a Set ...
        (old.mode = 'STOCK' and old.state = 'IN_STOCK' and old.set_id is null
          and new.mode = 'SET_MEMBER' and new.set_id is not null)
        -- ... and the one it replaces leaves the Set for Service.
        or (old.set_id is not null and new.set_id is null and new.mode = 'STANDALONE' and new.state = 'SERVICE')
        -- Back to Stock from Lost or Service.
        or (old.state in ('LOST', 'SERVICE') and new.mode = 'STOCK' and new.state = 'IN_STOCK'
          and new.set_id is null)));
    if not allowed then
      -- The move is refused as a whole: the instrument stays where it was.
      new.set_id := old.set_id;
      new.mode := old.mode;
      new.state := old.state;
      new.department := old.department;
    end if;
  end if;
  return new;
end $fn$;
