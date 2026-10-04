-- A hospital is opened for standard use or for a trial that ends on a date. When a trial ends the
-- hospital is locked: its users see who to contact, and the database refuses every read and change
-- of its data until the platform owner extends the trial or turns it into standard use.
alter table public.organizations
  add column if not exists plan text not null default 'STANDARD' check (plan in ('STANDARD', 'TRIAL')),
  add column if not exists trial_ends_at timestamptz;

-- Whether the signed-in user's hospital is a trial that has ended (read once per query).
create or replace function public.current_org_locked() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select o.plan = 'TRIAL' and o.trial_ends_at is not null and o.trial_ends_at <= now()
       from public.organizations o where o.id = public.current_org_id()),
    false)
$$;
revoke all on function public.current_org_locked() from public, anon;
grant execute on function public.current_org_locked() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'instruments', 'instrument_sets', 'movements', 'issues', 'receipts', 'deliveries', 'preparations',
    'surgical_counts', 'workflow_checkpoints', 'sterilization_cycles', 'sterilization_releases',
    'process_loads', 'recall_cases', 'hospital_settings', 'departments', 'devices', 'device_readings',
    'asset_imports'
  ] loop
    execute format(
      'create policy trial_lock on public.%I as restrictive for all to authenticated '
      'using (public.is_platform_admin() or not (select public.current_org_locked())) '
      'with check (public.is_platform_admin() or not (select public.current_org_locked()))', t);
  end loop;
end $$;

-- Who a locked hospital contacts: set by the platform owner in Studio → Settings.
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  contact_name text,
  contact_email text,
  contact_phone text,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (true) on conflict (id) do nothing;
alter table public.platform_settings enable row level security;
create policy platform_settings_read on public.platform_settings for select to authenticated using (true);
create policy platform_settings_update on public.platform_settings for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke all on public.platform_settings from anon;
grant select, update on public.platform_settings to authenticated;

-- Bulk import of Sets and instruments: the platform owner for any hospital, and inside a hospital
-- its admin and its sterilization supervisor.
create or replace function public.can_import_assets(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or (p_org is not null and p_org = public.current_org_id() and exists (
            select 1 from public.profiles p
             where p.id = auth.uid() and p.active
               and (p.role = 'ADMIN' or (p.role = 'STERILIZATION' and p.supervisor))))
$$;
revoke all on function public.can_import_assets(uuid) from public, anon;
grant execute on function public.can_import_assets(uuid) to authenticated;
alter policy asset_imports_read on public.asset_imports using (public.can_import_assets(organization_id));
alter policy asset_imports_insert on public.asset_imports with check (public.can_import_assets(organization_id));
alter policy asset_imports_update on public.asset_imports
  using (public.can_import_assets(organization_id)) with check (public.can_import_assets(organization_id));
