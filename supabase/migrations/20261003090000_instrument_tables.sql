-- Phase 1 of moving the hospital data out of app_records (one JSON document per record) into
-- relational tables: Sets (instrument_sets) and instruments. Each known field gets its own column;
-- anything the app adds later and has no column yet is kept in `extra`, so nothing is ever lost.
-- Dates the app shows as typed (e.g. "03/11/2025") stay text until the app writes ISO dates.

-- The first relational draft was never used by the app and holds no rows: it goes.
drop table if exists public.process_load_items, public.process_loads, public.recall_items, public.recall_cases,
  public.workflow_events, public.asset_photos, public.library_items, public.system_settings,
  public.role_permissions, public.workflow_versions, public.configuration_audit, public.movements,
  public.issues, public.tools, public.sets;

create table public.instrument_sets (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  barcode text not null check (barcode <> ''),
  legacy_barcodes text[],
  code text not null default '',
  name text not null,
  department text,
  specialty text,
  manufacturer text,
  category text,
  state text not null check (state in ('IN_DEPARTMENT','PENDING_STERILIZATION','IN_WASHING','IN_PREPARATION',
    'IN_PACKAGING','IN_STERILIZATION','AWAITING_RELEASE','IN_STORAGE','READY_FOR_PICKUP','IN_STOCK','SERVICE','LOST','RETIRED')),
  expected integer not null default 0 check (expected >= 0),
  actual integer not null default 0 check (actual >= 0),
  uses integer check (uses >= 0),
  max_uses integer check (max_uses >= 0),
  patient_code text,
  created_on text,
  notes text,
  composition_template jsonb,
  photos jsonb,
  color_tapes text[],
  ownership text check (ownership in ('HOSPITAL','DOCTOR','OTHER')),
  owner_name text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id),
  unique (organization_id, barcode)
);

create table public.instruments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  barcode text not null check (barcode <> ''),
  legacy_barcodes text[],
  code text not null default '',
  name text not null,
  department text,
  specialty text,
  manufacturer text,
  mode text not null check (mode in ('STANDALONE','SET_MEMBER','STOCK')),
  set_id text,
  state text not null check (state in ('IN_DEPARTMENT','PENDING_STERILIZATION','IN_WASHING','IN_PREPARATION',
    'IN_PACKAGING','IN_STERILIZATION','AWAITING_RELEASE','IN_STORAGE','READY_FOR_PICKUP','IN_STOCK','SERVICE','LOST','RETIRED')),
  uses integer not null default 0 check (uses >= 0),
  max_uses integer check (max_uses >= 0),
  sterilizations integer not null default 0 check (sterilizations >= 0),
  serial_number text,
  purchase_date text,
  warranty_until text,
  cost numeric,
  notes text,
  image_url text,
  photos jsonb,
  color_mode text check (color_mode in ('SET','OWN','NONE')),
  color_tapes text[],
  ownership text check (ownership in ('HOSPITAL','DOCTOR','OTHER')),
  owner_name text,
  retired_at text,
  retired_reason text,
  retired_notice_seen_at text,
  retired_notice_seen_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id),
  unique (organization_id, barcode)
);

-- The store's order (newest first), a Set's instruments, and the usual filters.
create index instrument_sets_org_created_idx on public.instrument_sets (organization_id, created_at desc);
create index instruments_org_created_idx on public.instruments (organization_id, created_at desc);
create index instruments_org_set_idx on public.instruments (organization_id, set_id) where set_id is not null;
create index instruments_org_state_idx on public.instruments (organization_id, state);
create index instrument_sets_updated_by_idx on public.instrument_sets (updated_by);
create index instruments_updated_by_idx on public.instruments (updated_by);

-- Same rules as the app_records rows they replace: everyone in the hospital reads; Sterilization
-- (and the platform admin) registers and deletes; any hospital role updates (handovers move state);
-- viewers never write.
alter table public.instrument_sets enable row level security;
alter table public.instruments enable row level security;
do $$
declare
  t text;
  c text;
begin
  foreach t in array array['instrument_sets','instruments'] loop
    c := case t when 'instrument_sets' then 'sets' else 'tools' end;
    execute format($p$create policy %1$s_read on public.%1$s for select to authenticated
      using (organization_id = public.current_org_id() or public.is_platform_admin())$p$, t);
    execute format($p$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check ((organization_id = public.current_org_id() or public.is_platform_admin())
        and public.app_record_writable(%2$L) and (public.is_cssd_operator() or public.is_platform_admin()))$p$, t, c);
    execute format($p$create policy %1$s_update on public.%1$s for update to authenticated
      using ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable(%2$L))
      with check ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable(%2$L))$p$, t, c);
    execute format($p$create policy %1$s_delete on public.%1$s for delete to authenticated
      using ((organization_id = public.current_org_id() or public.is_platform_admin())
        and (public.is_cssd_operator() or public.is_platform_admin()))$p$, t);
    execute format('create policy viewer_no_insert on public.%I as restrictive for insert to authenticated with check (not public.is_viewer())', t);
    execute format('create policy viewer_no_update on public.%I as restrictive for update to authenticated using (not public.is_viewer())', t);
    execute format('create policy viewer_no_delete on public.%I as restrictive for delete to authenticated using (not public.is_viewer())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Record (the app's JSON shape) <-> row. Used to copy the data over and, during the switch, to keep
-- app_records and the new tables in step for browsers still running the previous version.
create or replace function public.jsonb_text_array(v jsonb) returns text[]
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(v) = 'array' then array(select jsonb_array_elements_text(v)) end
$$;

create or replace function public.instrument_set_from_record(p_org uuid, p_id text, d jsonb, p_created timestamptz)
returns public.instrument_sets language sql stable set search_path = public as $$
  select row(
    p_org, p_id, d->>'barcode', public.jsonb_text_array(d->'legacyBarcodes'),
    coalesce(d->>'code', ''), coalesce(d->>'name', ''), d->>'department', d->>'specialty', d->>'manufacturer', d->>'category',
    d->>'state', coalesce((d->>'expected')::int, 0), coalesce((d->>'actual')::int, 0), (d->>'uses')::int, (d->>'maxUses')::int,
    d->>'patientCode', d->>'createdAt', d->>'notes', d->'compositionTemplate', d->'photos',
    public.jsonb_text_array(d->'colorTapes'), d->>'ownership', d->>'ownerName',
    nullif(d - array['id','barcode','legacyBarcodes','code','name','department','specialty','manufacturer','category','state',
      'expected','actual','uses','maxUses','patientCode','createdAt','notes','compositionTemplate','photos','colorTapes',
      'ownership','ownerName'], '{}'::jsonb),
    coalesce(p_created, now()), now(), null
  )::public.instrument_sets
$$;

create or replace function public.instrument_from_record(p_org uuid, p_id text, d jsonb, p_created timestamptz)
returns public.instruments language sql stable set search_path = public as $$
  select row(
    p_org, p_id, d->>'barcode', public.jsonb_text_array(d->'legacyBarcodes'),
    coalesce(d->>'code', ''), coalesce(d->>'name', ''), d->>'department', d->>'specialty', d->>'manufacturer',
    d->>'mode', d->>'setId', d->>'state', coalesce((d->>'uses')::int, 0), (d->>'maxUses')::int,
    coalesce((d->>'sterilizations')::int, 0), d->>'serialNumber', d->>'purchaseDate', d->>'warrantyUntil',
    (d->>'cost')::numeric, d->>'notes', d->>'imageUrl', d->'photos', d->>'colorMode',
    public.jsonb_text_array(d->'colorTapes'), d->>'ownership', d->>'ownerName',
    d->>'retiredAt', d->>'retiredReason', d->>'retiredNoticeSeenAt', d->>'retiredNoticeSeenBy',
    nullif(d - array['id','barcode','legacyBarcodes','code','name','department','specialty','manufacturer','mode','setId','state',
      'uses','maxUses','sterilizations','serialNumber','purchaseDate','warrantyUntil','cost','notes','imageUrl','photos',
      'colorMode','colorTapes','ownership','ownerName','retiredAt','retiredReason','retiredNoticeSeenAt','retiredNoticeSeenBy'], '{}'::jsonb),
    coalesce(p_created, now()), now(), null
  )::public.instruments
$$;

create or replace function public.instrument_set_to_record(s public.instrument_sets) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'barcode', s.barcode, 'legacyBarcodes', to_jsonb(s.legacy_barcodes), 'code', s.code, 'name', s.name,
    'department', s.department, 'specialty', s.specialty, 'manufacturer', s.manufacturer, 'category', s.category,
    'state', s.state, 'expected', s.expected, 'actual', s.actual, 'uses', s.uses, 'maxUses', s.max_uses,
    'patientCode', s.patient_code, 'createdAt', s.created_on, 'notes', s.notes,
    'compositionTemplate', s.composition_template, 'photos', s.photos, 'colorTapes', to_jsonb(s.color_tapes),
    'ownership', s.ownership, 'ownerName', s.owner_name)) || coalesce(s.extra, '{}'::jsonb)
$$;

create or replace function public.instrument_to_record(t public.instruments) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'barcode', t.barcode, 'legacyBarcodes', to_jsonb(t.legacy_barcodes), 'code', t.code, 'name', t.name,
    'department', t.department, 'specialty', t.specialty, 'manufacturer', t.manufacturer, 'mode', t.mode,
    'setId', t.set_id, 'state', t.state, 'uses', t.uses, 'maxUses', t.max_uses, 'sterilizations', t.sterilizations,
    'serialNumber', t.serial_number, 'purchaseDate', t.purchase_date, 'warrantyUntil', t.warranty_until,
    'cost', t.cost, 'notes', t.notes, 'imageUrl', t.image_url, 'photos', t.photos, 'colorMode', t.color_mode,
    'colorTapes', to_jsonb(t.color_tapes), 'ownership', t.ownership, 'ownerName', t.owner_name,
    'retiredAt', t.retired_at, 'retiredReason', t.retired_reason, 'retiredNoticeSeenAt', t.retired_notice_seen_at,
    'retiredNoticeSeenBy', t.retired_notice_seen_by)) || coalesce(t.extra, '{}'::jsonb)
$$;

-- Copy everything over, keeping each record's creation and last-change details.
insert into public.instrument_sets
select (public.instrument_set_from_record(organization_id, id, data, created_at)).*
from public.app_records where collection = 'sets';
insert into public.instruments
select (public.instrument_from_record(organization_id, id, data, created_at)).*
from public.app_records where collection = 'tools';
update public.instrument_sets s set updated_at = r.updated_at, updated_by = r.updated_by
from public.app_records r where r.collection = 'sets' and r.organization_id = s.organization_id and r.id = s.id;
update public.instruments t set updated_at = r.updated_at, updated_by = r.updated_by
from public.app_records r where r.collection = 'tools' and r.organization_id = t.organization_id and r.id = t.id;

-- Transition: browsers still on the previous version write app_records; the new version writes the
-- tables. Each side is mirrored into the other until the cleanup migration removes app_records' copy.
create or replace function public.mirror_app_records_instruments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('surgitrack.mirroring', true) = 'on' then return null; end if;
  if (case tg_op when 'DELETE' then old.collection else new.collection end) not in ('sets','tools') then return null; end if;
  perform set_config('surgitrack.mirroring', 'on', true);
  if tg_op = 'DELETE' then
    if old.collection = 'sets' then delete from public.instrument_sets where organization_id = old.organization_id and id = old.id;
    else delete from public.instruments where organization_id = old.organization_id and id = old.id; end if;
  elsif new.collection = 'sets' then
    insert into public.instrument_sets
    select (public.instrument_set_from_record(new.organization_id, new.id, new.data, new.created_at)).*
    on conflict (organization_id, id) do update set
      barcode = excluded.barcode, legacy_barcodes = excluded.legacy_barcodes, code = excluded.code, name = excluded.name,
      department = excluded.department, specialty = excluded.specialty, manufacturer = excluded.manufacturer,
      category = excluded.category, state = excluded.state, expected = excluded.expected, actual = excluded.actual,
      uses = excluded.uses, max_uses = excluded.max_uses, patient_code = excluded.patient_code, created_on = excluded.created_on,
      notes = excluded.notes, composition_template = excluded.composition_template, photos = excluded.photos,
      color_tapes = excluded.color_tapes, ownership = excluded.ownership, owner_name = excluded.owner_name,
      extra = excluded.extra, updated_by = new.updated_by;
  else
    insert into public.instruments
    select (public.instrument_from_record(new.organization_id, new.id, new.data, new.created_at)).*
    on conflict (organization_id, id) do update set
      barcode = excluded.barcode, legacy_barcodes = excluded.legacy_barcodes, code = excluded.code, name = excluded.name,
      department = excluded.department, specialty = excluded.specialty, manufacturer = excluded.manufacturer,
      mode = excluded.mode, set_id = excluded.set_id, state = excluded.state, uses = excluded.uses, max_uses = excluded.max_uses,
      sterilizations = excluded.sterilizations, serial_number = excluded.serial_number, purchase_date = excluded.purchase_date,
      warranty_until = excluded.warranty_until, cost = excluded.cost, notes = excluded.notes, image_url = excluded.image_url,
      photos = excluded.photos, color_mode = excluded.color_mode, color_tapes = excluded.color_tapes,
      ownership = excluded.ownership, owner_name = excluded.owner_name, retired_at = excluded.retired_at,
      retired_reason = excluded.retired_reason, retired_notice_seen_at = excluded.retired_notice_seen_at,
      retired_notice_seen_by = excluded.retired_notice_seen_by, extra = excluded.extra, updated_by = new.updated_by;
  end if;
  perform set_config('surgitrack.mirroring', 'off', true);
  return null;
end $$;

create or replace function public.mirror_instruments_to_app_records() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c text := case tg_table_name when 'instrument_sets' then 'sets' else 'tools' end;
begin
  if current_setting('surgitrack.mirroring', true) = 'on' then return null; end if;
  perform set_config('surgitrack.mirroring', 'on', true);
  if tg_op = 'DELETE' then
    delete from public.app_records where organization_id = old.organization_id and collection = c and id = old.id;
  else
    insert into public.app_records (organization_id, collection, id, data, created_at, updated_at, updated_by)
    values (new.organization_id, c, new.id,
      case c when 'sets' then public.instrument_set_to_record(new::public.instrument_sets)
             else public.instrument_to_record(new::public.instruments) end,
      new.created_at, now(), new.updated_by)
    on conflict (organization_id, collection, id) do update
      set data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end if;
  perform set_config('surgitrack.mirroring', 'off', true);
  return null;
end $$;
revoke execute on function public.mirror_app_records_instruments(), public.mirror_instruments_to_app_records()
  from public, anon, authenticated;

create trigger app_records_mirror_instruments after insert or update or delete on public.app_records
  for each row execute function public.mirror_app_records_instruments();
create trigger instrument_sets_mirror_app_records after insert or update or delete on public.instrument_sets
  for each row execute function public.mirror_instruments_to_app_records();
create trigger instruments_mirror_app_records after insert or update or delete on public.instruments
  for each row execute function public.mirror_instruments_to_app_records();

-- Keep updated_at / updated_by honest on every change.
create or replace function public.touch_instrument_row() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
create trigger instrument_sets_touch before update on public.instrument_sets
  for each row execute function public.touch_instrument_row();
create trigger instruments_touch before update on public.instruments
  for each row execute function public.touch_instrument_row();

-- A department rename follows into the new tables too.
create or replace function public.rename_department_references() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.app_records
       set data = jsonb_set(data, '{department}', to_jsonb(new.name)), updated_at = now()
     where organization_id = new.organization_id and collection in ('sets','tools','issues')
       and data->>'department' = old.name;
    perform set_config('surgitrack.mirroring', 'on', true);
    update public.instrument_sets set department = new.name
     where organization_id = new.organization_id and department = old.name;
    update public.instruments set department = new.name
     where organization_id = new.organization_id and department = old.name;
    perform set_config('surgitrack.mirroring', 'off', true);
  end if;
  return new;
end $$;

-- Resetting a Demo hospital clears its Sets and instruments as well.
create or replace function public.platform_reset_demo_organization(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.organizations where id = p_org and is_demo) then
    raise exception 'not a demo organization';
  end if;
  perform set_config('surgitrack.mirroring', 'on', true);
  delete from public.instruments where organization_id = p_org;
  delete from public.instrument_sets where organization_id = p_org;
  delete from public.app_records where organization_id = p_org;
  perform set_config('surgitrack.mirroring', 'off', true);
end $$;
