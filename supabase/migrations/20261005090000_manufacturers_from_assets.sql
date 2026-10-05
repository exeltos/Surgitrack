-- The hospital's manufacturer library always lists every manufacturer its tools and Sets use.
-- Imports and edits write the manufacturer on the asset only; until now the library (Studio →
-- Βιβλιοθήκες → Κατασκευαστές) knew only the names typed into it by hand.
--  - merge_used_manufacturers: the library plus any manufacturer in use that it lacks
--    (compared without case or surrounding spaces).
--  - hospital_settings: every save keeps those names, so an older copy of the library open in a
--    browser cannot drop them.
--  - instruments / instrument_sets: a new or changed manufacturer is added at once (one update
--    per statement, so a bulk import of thousands of rows touches the library once).
-- Run in the Supabase SQL Editor (it contains UPDATE statements).

create or replace function public.merge_used_manufacturers(p_org uuid, p_current jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with current_items as (
    select coalesce(p_current, '[]'::jsonb) as items
  ),
  known as (
    select upper(trim(coalesce(i->>'el', ''))) as k from current_items, jsonb_array_elements(items) i
    union
    select upper(trim(coalesce(i->>'en', ''))) from current_items, jsonb_array_elements(items) i
  ),
  used as (
    select distinct on (upper(trim(m))) trim(m) as name
    from (
      select manufacturer as m from public.instruments where organization_id = p_org
      union all
      select manufacturer from public.instrument_sets where organization_id = p_org
    ) a
    where m is not null and trim(m) <> ''
    order by upper(trim(m)), trim(m)
  ),
  missing as (
    select name from used where upper(name) not in (select k from known)
  )
  select (select items from current_items) || coalesce(
    (select jsonb_agg(jsonb_build_object('id', 'mfr-' || md5(upper(name)), 'el', name, 'en', name) order by name) from missing),
    '[]'::jsonb)
$$;

create or replace function public.hospital_settings_keep_manufacturers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.manufacturers := public.merge_used_manufacturers(new.organization_id, new.manufacturers);
  return new;
end $$;

drop trigger if exists hospital_settings_keep_manufacturers on public.hospital_settings;
create trigger hospital_settings_keep_manufacturers
  before insert or update on public.hospital_settings
  for each row execute function public.hospital_settings_keep_manufacturers();

create or replace function public.asset_manufacturers_to_library()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Touching the row runs hospital_settings_keep_manufacturers, which adds what is missing.
  update public.hospital_settings hs
     set manufacturers = hs.manufacturers
   where hs.organization_id in (
     select distinct n.organization_id from new_rows n
      where n.manufacturer is not null and trim(n.manufacturer) <> '')
     and exists (
       select 1 from new_rows n
        where n.organization_id = hs.organization_id
          and n.manufacturer is not null and trim(n.manufacturer) <> ''
          and upper(trim(n.manufacturer)) not in (
            select upper(trim(coalesce(i->>'el', ''))) from jsonb_array_elements(coalesce(hs.manufacturers, '[]'::jsonb)) i
            union
            select upper(trim(coalesce(i->>'en', ''))) from jsonb_array_elements(coalesce(hs.manufacturers, '[]'::jsonb)) i));
  return null;
end $$;

drop trigger if exists instruments_manufacturers_insert on public.instruments;
create trigger instruments_manufacturers_insert
  after insert on public.instruments
  referencing new table as new_rows
  for each statement execute function public.asset_manufacturers_to_library();
drop trigger if exists instruments_manufacturers_update on public.instruments;
create trigger instruments_manufacturers_update
  after update on public.instruments
  referencing new table as new_rows
  for each statement execute function public.asset_manufacturers_to_library();
drop trigger if exists instrument_sets_manufacturers_insert on public.instrument_sets;
create trigger instrument_sets_manufacturers_insert
  after insert on public.instrument_sets
  referencing new table as new_rows
  for each statement execute function public.asset_manufacturers_to_library();
drop trigger if exists instrument_sets_manufacturers_update on public.instrument_sets;
create trigger instrument_sets_manufacturers_update
  after update on public.instrument_sets
  referencing new table as new_rows
  for each statement execute function public.asset_manufacturers_to_library();

revoke execute on function public.merge_used_manufacturers(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.hospital_settings_keep_manufacturers() from public, anon, authenticated;
revoke execute on function public.asset_manufacturers_to_library() from public, anon, authenticated;

-- Today's libraries: add every manufacturer already in use.
update public.hospital_settings set manufacturers = manufacturers;
