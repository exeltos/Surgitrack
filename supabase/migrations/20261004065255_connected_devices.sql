-- Connected devices (sterilizers, washers, sealers…) and the cycle data they send. A device sends
-- through the device-ingest edge function with its own key (network), or its data is uploaded as a
-- file or read from a serial cable in the browser. Readings are history: added, never changed.
create table public.devices (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  name text not null,
  kind text not null default 'STERILIZER' check (kind in ('STERILIZER', 'WASHER', 'SEALER', 'OTHER')),
  manufacturer text,
  model text,
  serial_number text,
  location text,
  connection text not null default 'FILE' check (connection in ('API', 'FILE', 'SERIAL')),
  active boolean not null default true,
  key_hint text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id),
  unique (id)
);
create index devices_updated_by_idx on public.devices (updated_by);
create trigger devices_touch before update on public.devices for each row execute function public.touch_updated_row();
alter table public.devices enable row level security;
create policy devices_read on public.devices for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());
create policy devices_insert on public.devices for insert to authenticated
  with check (public.is_org_admin(organization_id));
create policy devices_update on public.devices for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy devices_delete on public.devices for delete to authenticated
  using (public.is_org_admin(organization_id));
create policy viewer_no_insert on public.devices as restrictive for insert to authenticated with check (not public.is_viewer());
create policy viewer_no_update on public.devices as restrictive for update to authenticated using (not public.is_viewer());
create policy viewer_no_delete on public.devices as restrictive for delete to authenticated using (not public.is_viewer());
revoke all on public.devices from anon;
grant select, insert, update, delete on public.devices to authenticated;

-- Network keys: only their hash is kept, and nobody reads this table but the server (the device-key
-- edge function writes it, device-ingest checks it).
create table public.device_keys (
  device_id uuid primary key references public.devices(id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.device_keys enable row level security;
revoke all on public.device_keys from anon, authenticated;

create table public.device_readings (
  organization_id uuid not null,
  id uuid not null default gen_random_uuid(),
  device_id uuid not null,
  cycle_number text not null,
  program text,
  started_at timestamptz,
  ended_at timestamptz,
  result text not null default 'UNKNOWN' check (result in ('PASS', 'FAIL', 'UNKNOWN')),
  max_temperature numeric,
  max_pressure numeric,
  duration_minutes numeric,
  source text not null check (source in ('API', 'FILE', 'SERIAL')),
  raw jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id),
  foreign key (organization_id, device_id) references public.devices(organization_id, id) on delete cascade,
  unique (device_id, cycle_number)
);
create index device_readings_device_idx on public.device_readings (organization_id, device_id, created_at desc);
create index device_readings_created_by_idx on public.device_readings (created_by);
alter table public.device_readings enable row level security;
create policy device_readings_read on public.device_readings for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());
create policy device_readings_insert on public.device_readings for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and (public.is_cssd_operator() or public.is_platform_admin()));
create policy viewer_no_insert on public.device_readings as restrictive for insert to authenticated with check (not public.is_viewer());
revoke all on public.device_readings from anon;
grant select, insert on public.device_readings to authenticated;
