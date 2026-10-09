-- The Sterilization supervisor's rights, enforced by the database and not only by the screens.
--
-- In the app (src/core/permissions.ts, supervisorOnlyPermissions) registering, editing, duplicating and
-- deleting Sets and instruments, reissuing barcodes, usage limits and Set composition belong to the
-- hospital admin and the Sterilization supervisor (profiles.supervisor). Until now the database let
-- every Sterilization user do them through the API. The per-role settings of Studio
-- (hospital_settings.role_permissions) likewise only hid buttons.
--
-- Who is what, in the database:
--   platform owner      is_platform_admin()                        everything, as before
--   hospital admin      current_role() = 'ADMIN'                   everything, as before
--   supervisor          current_role() = 'STERILIZATION' and profiles.supervisor
--   Sterilization user  current_role() = 'STERILIZATION', not supervisor
--   department user     current_role() = 'DEPARTMENT'  (department_guard_* triggers, unchanged)
--   viewer              never writes (viewer_no_* policies, unchanged)
--   service role        bypasses row level security; current_role() is null, so the triggers below
--                       leave its writes alone too.
--
-- What the server enforces, by permission (the rest stays a matter of the screens):
--   asset.create, asset.duplicate  creating a Set or an instrument: admin or supervisor; a
--                                  Sterilization user with stock.manage may add a plain Stock
--                                  instrument (receiving a purchase order). BEFORE INSERT trigger, so
--                                  the batch upsert the app uses for changes keeps working.
--   asset.delete                   deleting a Set or an instrument: admin or supervisor (policy).
--   asset.barcode.reissue          barcode, legacy_barcodes
--   asset.edit                     code, name, specialty, manufacturer, category, notes, created_on,
--                                  serial_number, purchase_date, warranty_until, cost, ownership,
--                                  owner_name, color_tapes, color_mode
--   asset.usage.configure          max_uses
--   asset.composition.manage       instrument_sets.composition_template and expected; an instrument
--                                  moving into or out of a Set, to Stock or Service (set_id, mode),
--                                  except the moves of ordinary work: out of use at its usage limit,
--                                  and, with stock.manage, replacing from Stock (into a Set from
--                                  Stock, the replaced one to Service) and back to Stock from
--                                  Lost/Service (Replacements page)
--   asset.photos.manage            photos, image_url (honours the Studio role settings)
--   stock.manage                   see above (honours the Studio role settings)
-- As with department users (20261008120000), a change a Sterilization user may not make keeps the
-- saved value instead of failing the whole save, so a device with an older picture still syncs.
-- Not enforced here (side effects of other work, e.g. a count shortage opens an issue):
-- issue.create, counts.record, sterilization.*, department.*, the read permissions.

-- The admin, the Sterilization supervisor or the platform owner.
create or replace function public.is_asset_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.active
       and (p.role = 'ADMIN' or (p.role = 'STERILIZATION' and p.supervisor)))
$$;
revoke execute on function public.is_asset_manager() from public, anon;
grant execute on function public.is_asset_manager() to authenticated, service_role;

-- Whether the signed-in user holds a permission, as the app computes it (permissionsForRole in
-- src/core/permissions.ts): the admin holds all; in Sterilization the supervisor-only ones follow
-- the supervisor flag; what a role can never have is refused and what it always keeps is granted;
-- the rest follows the hospital's role settings (Studio), or the role's defaults when there are none.
-- Keep the lists in step with permissions.ts.
create or replace function public.role_has_permission(p_permission text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  me public.profiles%rowtype;
  overrides jsonb;
  supervisor_only constant text[] := array['asset.barcode.reissue','asset.create','asset.edit','asset.delete',
    'asset.duplicate','asset.usage.configure','asset.composition.manage','overview.view'];
  viewer_defaults constant text[] := array['asset.registry.view','asset.detail.view','stock.manage','issue.view',
    'history.view','reports.view','traceability.view','overview.view'];
  department_defaults constant text[] := array['asset.detail.view','department.workspace','department.dispatch',
    'issue.view','issue.create','history.view','counts.record'];
  sterilization_defaults constant text[] := array['asset.registry.view','asset.detail.view','asset.create',
    'asset.edit','asset.delete','asset.duplicate','asset.photos.manage','asset.barcode.reissue',
    'asset.usage.configure','asset.composition.manage','stock.manage','sterilization.workspace',
    'sterilization.receive','sterilization.prepare','sterilization.cycle','sterilization.deliver','issue.view',
    'issue.create','history.view','reports.view','traceability.view','counts.record','overview.view'];
  defaults text[];
  protected text[];
  unavailable text[];
begin
  if public.is_platform_admin() then return true; end if;
  select * into me from public.profiles where id = auth.uid() and active;
  if me.id is null or me.organization_id is null then return false; end if;
  if me.role = 'ADMIN' then return true; end if;
  if me.role = 'STERILIZATION' and p_permission = any (supervisor_only) then return me.supervisor; end if;
  case me.role
    when 'STERILIZATION' then
      defaults := sterilization_defaults;
      protected := array['asset.detail.view','sterilization.workspace','sterilization.receive',
        'sterilization.cycle','sterilization.deliver','history.view','traceability.view'];
      unavailable := array['department.workspace','department.dispatch','studio.manage'];
    when 'DEPARTMENT' then
      defaults := department_defaults;
      protected := array['asset.detail.view','department.workspace','department.dispatch','issue.create',
        'history.view'];
      unavailable := array['asset.registry.view','asset.create','asset.edit','asset.delete','asset.duplicate',
        'asset.photos.manage','asset.barcode.reissue','asset.usage.configure','asset.composition.manage',
        'stock.manage','sterilization.workspace','sterilization.receive','sterilization.prepare',
        'sterilization.cycle','sterilization.deliver','reports.view','traceability.view','overview.view',
        'studio.manage'];
    when 'VIEWER' then
      -- A viewer never gets an action, whatever the settings say.
      return p_permission = any (viewer_defaults);
    else
      return false;
  end case;
  if p_permission = any (unavailable) then return false; end if;
  if p_permission = any (protected) then return true; end if;
  select hs.role_permissions -> me.role::text into overrides
    from public.hospital_settings hs
   where hs.organization_id = me.organization_id
   order by (hs.id = 'state') desc, hs.updated_at desc
   limit 1;
  if jsonb_typeof(overrides) = 'array' then
    return overrides ? p_permission;
  end if;
  return p_permission = any (defaults);
end $$;
revoke execute on function public.role_has_permission(text) from public, anon;
grant execute on function public.role_has_permission(text) to authenticated, service_role;

-- Deleting a Set or an instrument: the admin or the supervisor (and the platform owner).
alter policy instrument_sets_delete on public.instrument_sets
  using ((organization_id = (select public.current_org_id()) or (select public.is_platform_admin()))
    and (select public.is_asset_manager()));
alter policy instruments_delete on public.instruments
  using ((organization_id = (select public.current_org_id()) or (select public.is_platform_admin()))
    and (select public.is_asset_manager()));

-- Creating one. The insert policies stay as they are (Sterilization and admin), because the app saves
-- changes with an upsert, which is checked against the insert policy even when the row exists.
-- A Sterilization user (not supervisor) is refused here only when the row is really new.
create or replace function public.supervisor_guard_insert() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if public."current_role"() is distinct from 'STERILIZATION' or public.is_asset_manager() then
    return new;
  end if;
  if tg_table_name = 'instrument_sets' then
    if exists (select 1 from public.instrument_sets where organization_id = new.organization_id and id = new.id) then
      return new;
    end if;
  else
    if exists (select 1 from public.instruments where organization_id = new.organization_id and id = new.id) then
      return new;
    end if;
    -- Receiving a purchase order puts new instruments in Stock (stock.manage).
    if new.mode = 'STOCK' and new.state = 'IN_STOCK' and new.set_id is null
      and public.role_has_permission('stock.manage') then
      return new;
    end if;
  end if;
  raise exception 'only the hospital admin or the Sterilization supervisor registers Sets and instruments'
    using errcode = '42501';
end $fn$;

-- Changing one: what a Sterilization user may not change keeps its saved value (see the list above).
create or replace function public.supervisor_guard_set() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if public."current_role"() is distinct from 'STERILIZATION' or public.is_platform_admin() then
    return new;
  end if;
  if (new.photos is distinct from old.photos) and not public.role_has_permission('asset.photos.manage') then
    new.photos := old.photos;
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
  new.category := old.category;
  new.notes := old.notes;
  new.created_on := old.created_on;
  new.color_tapes := old.color_tapes;
  new.ownership := old.ownership;
  new.owner_name := old.owner_name;
  new.max_uses := old.max_uses;
  new.composition_template := old.composition_template;
  new.expected := old.expected;
  return new;
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

revoke execute on function public.supervisor_guard_insert() from public, anon, authenticated;
revoke execute on function public.supervisor_guard_set() from public, anon, authenticated;
revoke execute on function public.supervisor_guard_instrument() from public, anon, authenticated;

-- BEFORE UPDATE triggers run in name order: a_version_check, department_guard, supervisor_guard, touch.
drop trigger if exists instrument_sets_supervisor_guard on public.instrument_sets;
create trigger instrument_sets_supervisor_guard before update on public.instrument_sets
  for each row execute function public.supervisor_guard_set();
drop trigger if exists instruments_supervisor_guard on public.instruments;
create trigger instruments_supervisor_guard before update on public.instruments
  for each row execute function public.supervisor_guard_instrument();
drop trigger if exists instrument_sets_supervisor_guard_insert on public.instrument_sets;
create trigger instrument_sets_supervisor_guard_insert before insert on public.instrument_sets
  for each row execute function public.supervisor_guard_insert();
drop trigger if exists instruments_supervisor_guard_insert on public.instruments;
create trigger instruments_supervisor_guard_insert before insert on public.instruments
  for each row execute function public.supervisor_guard_insert();
