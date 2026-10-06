-- Phase 4: sterilization cycles and releases (signed history) and process loads and recall cases
-- (which change as they progress) leave app_records for their own tables.
-- Dates the app shows as typed stay text; created_at keeps the true order.

-- Stamps every change of a record that changes over time (who and when).
create or replace function public.touch_updated_row() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;

create table public.sterilization_cycles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  workflow_version integer,
  load_id text,
  asset_id text,
  asset_kind text,
  barcode text,
  asset_name text,
  department text,
  sterilizer text,
  cycle_number text,
  program text,
  indicator_result text,
  result text,
  note text,
  completed_by_user_id text,
  completed_by_name text,
  completed_by_department text,
  completed_on text,
  tool_ids text[],
  extra jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index sterilization_cycles_org_created_idx on public.sterilization_cycles (organization_id, created_at desc);

create index sterilization_cycles_created_by_idx on public.sterilization_cycles (created_by);

alter table public.sterilization_cycles enable row level security;

create policy sterilization_cycles_read on public.sterilization_cycles for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy sterilization_cycles_insert on public.sterilization_cycles for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('sterilizationCycles'));

create policy viewer_no_insert on public.sterilization_cycles as restrictive for insert to authenticated with check (not public.is_viewer());

revoke all on public.sterilization_cycles from anon;
grant select, insert on public.sterilization_cycles to authenticated;

create table public.sterilization_releases (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  workflow_version integer,
  load_id text,
  asset_id text,
  asset_kind text,
  barcode text,
  asset_name text,
  department text,
  cycle_record_id text,
  cycle_number text,
  sterilizer text,
  physical_parameters_ok boolean,
  chemical_indicator_ok boolean,
  packaging_integrity_ok boolean,
  biological_indicator_result text,
  decision text,
  note text,
  released_by_user_id text,
  released_by_name text,
  released_by_department text,
  released_on text,
  extra jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index sterilization_releases_org_created_idx on public.sterilization_releases (organization_id, created_at desc);

create index sterilization_releases_created_by_idx on public.sterilization_releases (created_by);

alter table public.sterilization_releases enable row level security;

create policy sterilization_releases_read on public.sterilization_releases for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy sterilization_releases_insert on public.sterilization_releases for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('sterilizationReleases'));

create policy viewer_no_insert on public.sterilization_releases as restrictive for insert to authenticated with check (not public.is_viewer());

revoke all on public.sterilization_releases from anon;
grant select, insert on public.sterilization_releases to authenticated;

create table public.process_loads (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  workflow_version integer,
  kind text,
  equipment text,
  cycle_number text,
  program text,
  status text,
  items jsonb,
  chemical_indicator_result text,
  biological_indicator_result text,
  physical_parameters_ok boolean,
  packaging_integrity_ok boolean,
  note text,
  created_by_user_id text,
  created_by_name text,
  created_on text,
  completed_on text,
  released_on text,
  recalled_on text,
  recall_reason text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index process_loads_org_created_idx on public.process_loads (organization_id, created_at desc);

create index process_loads_updated_by_idx on public.process_loads (updated_by);

alter table public.process_loads enable row level security;

create policy process_loads_read on public.process_loads for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy process_loads_insert on public.process_loads for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('processLoads'));

create policy viewer_no_insert on public.process_loads as restrictive for insert to authenticated with check (not public.is_viewer());

create policy process_loads_update on public.process_loads for update to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable('processLoads'))
  with check ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable('processLoads'));

create policy viewer_no_update on public.process_loads as restrictive for update to authenticated using (not public.is_viewer());

create trigger process_loads_touch before update on public.process_loads for each row execute function public.touch_updated_row();

revoke all on public.process_loads from anon;
grant select, insert, update on public.process_loads to authenticated;

create table public.recall_cases (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  load_id text,
  cycle_number text,
  sterilizer text,
  reason text,
  opened_on text,
  opened_by_user_id text,
  opened_by_name text,
  status text,
  items jsonb,
  closed_on text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index recall_cases_org_created_idx on public.recall_cases (organization_id, created_at desc);

create index recall_cases_updated_by_idx on public.recall_cases (updated_by);

alter table public.recall_cases enable row level security;

create policy recall_cases_read on public.recall_cases for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy recall_cases_insert on public.recall_cases for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('recallCases'));

create policy viewer_no_insert on public.recall_cases as restrictive for insert to authenticated with check (not public.is_viewer());

create policy recall_cases_update on public.recall_cases for update to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable('recallCases'))
  with check ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable('recallCases'));

create policy viewer_no_update on public.recall_cases as restrictive for update to authenticated using (not public.is_viewer());

create trigger recall_cases_touch before update on public.recall_cases for each row execute function public.touch_updated_row();

revoke all on public.recall_cases from anon;
grant select, insert, update on public.recall_cases to authenticated;

