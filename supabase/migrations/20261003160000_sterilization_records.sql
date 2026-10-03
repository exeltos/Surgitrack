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

-- The copy now covers this phase too (still safe to run again).
create or replace function public.copy_legacy_records() returns void
language sql security definer set search_path = public as $$
  insert into public.movements (organization_id, id, asset, asset_kind, from_location, to_location, status, at,
    by_name, patient_code, note, extra, created_at)
  select organization_id, id, coalesce(data->>'asset', ''), coalesce(data->>'assetKind', 'TOOL'), data->>'from', data->>'to',
    coalesce(data->>'status', ''), data->>'at', data->>'by', data->>'patientCode', data->>'note',
    nullif(data - array['id','asset','assetKind','from','to','status','at','by','patientCode','note'], '{}'::jsonb),
    created_at
  from public.app_records where collection = 'movements'
  on conflict (organization_id, id) do nothing;

  insert into public.issues (organization_id, id, asset, type, status, created_on, department, note, photos, extra,
    created_at, updated_at, updated_by)
  select organization_id, id, coalesce(data->>'asset', ''), coalesce(data->>'type', ''), coalesce(data->>'status', 'OPEN'),
    data->>'created', data->>'department', coalesce(data->>'note', ''), data->'photos',
    nullif(data - array['id','asset','type','status','created','department','note','photos'], '{}'::jsonb),
    created_at, updated_at, updated_by
  from public.app_records where collection = 'issues'
  -- A report changed later in app_records (an older browser) brings its change along.
  on conflict (organization_id, id) do update set
    asset = excluded.asset, type = excluded.type, status = excluded.status, created_on = excluded.created_on,
    department = excluded.department, note = excluded.note, photos = excluded.photos, extra = excluded.extra
  where excluded.updated_at > public.issues.updated_at;

  insert into public.receipts (organization_id, id, workflow_version, batch_id, asset_id, asset_kind, barcode, asset_name, from_department, to_department, delivered_by_user_id, delivered_by_name, delivered_by_department, received_by_user_id, received_by_name, received_by_department, at, note, visible_deviation, department_mismatch, department_mismatch_reason, expected, actual, check_performed, checked_count, check_result, check_note, item_checks, set_checks, extra, created_at)
  select organization_id, id, (data->>'workflowVersion')::integer, data->>'batchId', data->>'assetId', data->>'assetKind', data->>'barcode', data->>'assetName', data->>'fromDepartment', data->>'toDepartment', data->>'deliveredByUserId', data->>'deliveredByName', data->>'deliveredByDepartment', data->>'receivedByUserId', data->>'receivedByName', data->>'receivedByDepartment', data->>'at', data->>'note', (data->>'visibleDeviation')::boolean, (data->>'departmentMismatch')::boolean, data->>'departmentMismatchReason', (data->>'expected')::integer, (data->>'actual')::integer, (data->>'checkPerformed')::boolean, (data->>'checkedCount')::integer, data->>'checkResult', data->>'checkNote', data->'itemChecks', data->'setChecks',
    nullif(data - array['id','workflowVersion','batchId','assetId','assetKind','barcode','assetName','fromDepartment','toDepartment','deliveredByUserId','deliveredByName','deliveredByDepartment','receivedByUserId','receivedByName','receivedByDepartment','at','note','visibleDeviation','departmentMismatch','departmentMismatchReason','expected','actual','checkPerformed','checkedCount','checkResult','checkNote','itemChecks','setChecks'], '{}'::jsonb), created_at
  from public.app_records where collection = 'receipts'
  on conflict (organization_id, id) do nothing;

  insert into public.deliveries (organization_id, id, workflow_version, batch_id, asset_id, asset_kind, barcode, asset_name, department, delivered_by_user_id, delivered_by_name, delivered_by_department, received_by_user_id, received_by_name, received_by_department, at, note, extra, created_at)
  select organization_id, id, (data->>'workflowVersion')::integer, data->>'batchId', data->>'assetId', data->>'assetKind', data->>'barcode', data->>'assetName', data->>'department', data->>'deliveredByUserId', data->>'deliveredByName', data->>'deliveredByDepartment', data->>'receivedByUserId', data->>'receivedByName', data->>'receivedByDepartment', data->>'at', data->>'note',
    nullif(data - array['id','workflowVersion','batchId','assetId','assetKind','barcode','assetName','department','deliveredByUserId','deliveredByName','deliveredByDepartment','receivedByUserId','receivedByName','receivedByDepartment','at','note'], '{}'::jsonb), created_at
  from public.app_records where collection = 'deliveries'
  on conflict (organization_id, id) do nothing;

  insert into public.preparations (organization_id, id, workflow_version, asset_id, asset_kind, barcode, asset_name, department, prepared_by_user_id, prepared_by_name, prepared_by_department, at, tool_ids, checked_tool_ids, all_ok, process_checks, note, extra, created_at)
  select organization_id, id, (data->>'workflowVersion')::integer, data->>'assetId', data->>'assetKind', data->>'barcode', data->>'assetName', data->>'department', data->>'preparedByUserId', data->>'preparedByName', data->>'preparedByDepartment', data->>'at', (select array_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(data->'toolIds') = 'array' then data->'toolIds' end) x), (select array_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(data->'checkedToolIds') = 'array' then data->'checkedToolIds' end) x), (data->>'allOk')::boolean, data->'processChecks', data->>'note',
    nullif(data - array['id','workflowVersion','assetId','assetKind','barcode','assetName','department','preparedByUserId','preparedByName','preparedByDepartment','at','toolIds','checkedToolIds','allOk','processChecks','note'], '{}'::jsonb), created_at
  from public.app_records where collection = 'preparations'
  on conflict (organization_id, id) do nothing;

  insert into public.surgical_counts (organization_id, id, set_id, patient_code, expected, counted, result, note, at, by_name, signed, extra, created_at)
  select organization_id, id, data->>'setId', data->>'patientCode', (data->>'expected')::integer, (data->>'counted')::integer, data->>'result', data->>'note', data->>'at', data->>'by', (data->>'signed')::boolean,
    nullif(data - array['id','setId','patientCode','expected','counted','result','note','at','by','signed'], '{}'::jsonb), created_at
  from public.app_records where collection = 'counts'
  on conflict (organization_id, id) do nothing;

  insert into public.workflow_checkpoints (organization_id, id, workflow_version, asset_id, asset_kind, barcode, asset_name, department, stage_id, checks, note, completed_by_user_id, completed_by_name, completed_by_department, completed_on, extra, created_at)
  select organization_id, id, (data->>'workflowVersion')::integer, data->>'assetId', data->>'assetKind', data->>'barcode', data->>'assetName', data->>'department', data->>'stageId', data->'checks', data->>'note', data->>'completedByUserId', data->>'completedByName', data->>'completedByDepartment', data->>'completedAt',
    nullif(data - array['id','workflowVersion','assetId','assetKind','barcode','assetName','department','stageId','checks','note','completedByUserId','completedByName','completedByDepartment','completedAt'], '{}'::jsonb), created_at
  from public.app_records where collection = 'workflowCheckpoints'
  on conflict (organization_id, id) do nothing;

  insert into public.sterilization_cycles (organization_id, id, workflow_version, load_id, asset_id, asset_kind, barcode, asset_name, department, sterilizer, cycle_number, program, indicator_result, result, note, completed_by_user_id, completed_by_name, completed_by_department, completed_on, tool_ids, extra, created_at)
  select organization_id, id, (data->>'workflowVersion')::integer, data->>'loadId', data->>'assetId', data->>'assetKind', data->>'barcode', data->>'assetName', data->>'department', data->>'sterilizer', data->>'cycleNumber', data->>'program', data->>'indicatorResult', data->>'result', data->>'note', data->>'completedByUserId', data->>'completedByName', data->>'completedByDepartment', data->>'completedAt', (select array_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(data->'toolIds') = 'array' then data->'toolIds' end) x),
    nullif(data - array['id','workflowVersion','loadId','assetId','assetKind','barcode','assetName','department','sterilizer','cycleNumber','program','indicatorResult','result','note','completedByUserId','completedByName','completedByDepartment','completedAt','toolIds'], '{}'::jsonb), created_at
  from public.app_records where collection = 'sterilizationCycles'
  on conflict (organization_id, id) do nothing;

  insert into public.sterilization_releases (organization_id, id, workflow_version, load_id, asset_id, asset_kind, barcode, asset_name, department, cycle_record_id, cycle_number, sterilizer, physical_parameters_ok, chemical_indicator_ok, packaging_integrity_ok, biological_indicator_result, decision, note, released_by_user_id, released_by_name, released_by_department, released_on, extra, created_at)
  select organization_id, id, (data->>'workflowVersion')::integer, data->>'loadId', data->>'assetId', data->>'assetKind', data->>'barcode', data->>'assetName', data->>'department', data->>'cycleRecordId', data->>'cycleNumber', data->>'sterilizer', (data->>'physicalParametersOk')::boolean, (data->>'chemicalIndicatorOk')::boolean, (data->>'packagingIntegrityOk')::boolean, data->>'biologicalIndicatorResult', data->>'decision', data->>'note', data->>'releasedByUserId', data->>'releasedByName', data->>'releasedByDepartment', data->>'releasedAt',
    nullif(data - array['id','workflowVersion','loadId','assetId','assetKind','barcode','assetName','department','cycleRecordId','cycleNumber','sterilizer','physicalParametersOk','chemicalIndicatorOk','packagingIntegrityOk','biologicalIndicatorResult','decision','note','releasedByUserId','releasedByName','releasedByDepartment','releasedAt'], '{}'::jsonb), created_at
  from public.app_records where collection = 'sterilizationReleases'
  on conflict (organization_id, id) do nothing;

  insert into public.process_loads (organization_id, id, workflow_version, kind, equipment, cycle_number, program, status, items, chemical_indicator_result, biological_indicator_result, physical_parameters_ok, packaging_integrity_ok, note, created_by_user_id, created_by_name, created_on, completed_on, released_on, recalled_on, recall_reason, extra, created_at, updated_at, updated_by)
  select organization_id, id, (data->>'workflowVersion')::integer, data->>'kind', data->>'equipment', data->>'cycleNumber', data->>'program', data->>'status', data->'items', data->>'chemicalIndicatorResult', data->>'biologicalIndicatorResult', (data->>'physicalParametersOk')::boolean, (data->>'packagingIntegrityOk')::boolean, data->>'note', data->>'createdByUserId', data->>'createdByName', data->>'createdAt', data->>'completedAt', data->>'releasedAt', data->>'recalledAt', data->>'recallReason',
    nullif(data - array['id','workflowVersion','kind','equipment','cycleNumber','program','status','items','chemicalIndicatorResult','biologicalIndicatorResult','physicalParametersOk','packagingIntegrityOk','note','createdByUserId','createdByName','createdAt','completedAt','releasedAt','recalledAt','recallReason'], '{}'::jsonb), created_at, updated_at, updated_by
  from public.app_records where collection = 'processLoads'
  on conflict (organization_id, id) do update set
    workflow_version = excluded.workflow_version, kind = excluded.kind, equipment = excluded.equipment, cycle_number = excluded.cycle_number, program = excluded.program, status = excluded.status, items = excluded.items, chemical_indicator_result = excluded.chemical_indicator_result, biological_indicator_result = excluded.biological_indicator_result, physical_parameters_ok = excluded.physical_parameters_ok, packaging_integrity_ok = excluded.packaging_integrity_ok, note = excluded.note, created_by_user_id = excluded.created_by_user_id, created_by_name = excluded.created_by_name, created_on = excluded.created_on, completed_on = excluded.completed_on, released_on = excluded.released_on, recalled_on = excluded.recalled_on, recall_reason = excluded.recall_reason, extra = excluded.extra
  where excluded.updated_at > public.process_loads.updated_at;

  insert into public.recall_cases (organization_id, id, load_id, cycle_number, sterilizer, reason, opened_on, opened_by_user_id, opened_by_name, status, items, closed_on, extra, created_at, updated_at, updated_by)
  select organization_id, id, data->>'loadId', data->>'cycleNumber', data->>'sterilizer', data->>'reason', data->>'openedAt', data->>'openedByUserId', data->>'openedByName', data->>'status', data->'items', data->>'closedAt',
    nullif(data - array['id','loadId','cycleNumber','sterilizer','reason','openedAt','openedByUserId','openedByName','status','items','closedAt'], '{}'::jsonb), created_at, updated_at, updated_by
  from public.app_records where collection = 'recallCases'
  on conflict (organization_id, id) do update set
    load_id = excluded.load_id, cycle_number = excluded.cycle_number, sterilizer = excluded.sterilizer, reason = excluded.reason, opened_on = excluded.opened_on, opened_by_user_id = excluded.opened_by_user_id, opened_by_name = excluded.opened_by_name, status = excluded.status, items = excluded.items, closed_on = excluded.closed_on, extra = excluded.extra
  where excluded.updated_at > public.recall_cases.updated_at;
$$;
revoke execute on function public.copy_legacy_records() from public, anon, authenticated;

select public.copy_legacy_records();
