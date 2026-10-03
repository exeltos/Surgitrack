-- Phase 3: receipts, deliveries, preparations, surgical counts and workflow checkpoints leave
-- app_records for their own tables. All are signed history: written once, never changed.
-- Dates the app shows as typed stay text; created_at keeps the true order.

create table public.receipts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  workflow_version integer,
  batch_id text,
  asset_id text,
  asset_kind text,
  barcode text,
  asset_name text,
  from_department text,
  to_department text,
  delivered_by_user_id text,
  delivered_by_name text,
  delivered_by_department text,
  received_by_user_id text,
  received_by_name text,
  received_by_department text,
  at text,
  note text,
  visible_deviation boolean,
  department_mismatch boolean,
  department_mismatch_reason text,
  expected integer,
  actual integer,
  check_performed boolean,
  checked_count integer,
  check_result text,
  check_note text,
  item_checks jsonb,
  set_checks jsonb,
  extra jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index receipts_org_created_idx on public.receipts (organization_id, created_at desc);

create index receipts_created_by_idx on public.receipts (created_by);

alter table public.receipts enable row level security;

create policy receipts_read on public.receipts for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy receipts_insert on public.receipts for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('receipts'));

create policy viewer_no_insert on public.receipts as restrictive for insert to authenticated with check (not public.is_viewer());

revoke all on public.receipts from anon;
grant select, insert on public.receipts to authenticated;

create table public.deliveries (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  workflow_version integer,
  batch_id text,
  asset_id text,
  asset_kind text,
  barcode text,
  asset_name text,
  department text,
  delivered_by_user_id text,
  delivered_by_name text,
  delivered_by_department text,
  received_by_user_id text,
  received_by_name text,
  received_by_department text,
  at text,
  note text,
  extra jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index deliveries_org_created_idx on public.deliveries (organization_id, created_at desc);

create index deliveries_created_by_idx on public.deliveries (created_by);

alter table public.deliveries enable row level security;

create policy deliveries_read on public.deliveries for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy deliveries_insert on public.deliveries for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('deliveries'));

create policy viewer_no_insert on public.deliveries as restrictive for insert to authenticated with check (not public.is_viewer());

revoke all on public.deliveries from anon;
grant select, insert on public.deliveries to authenticated;

create table public.preparations (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  workflow_version integer,
  asset_id text,
  asset_kind text,
  barcode text,
  asset_name text,
  department text,
  prepared_by_user_id text,
  prepared_by_name text,
  prepared_by_department text,
  at text,
  tool_ids text[],
  checked_tool_ids text[],
  all_ok boolean,
  process_checks jsonb,
  note text,
  extra jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index preparations_org_created_idx on public.preparations (organization_id, created_at desc);

create index preparations_created_by_idx on public.preparations (created_by);

alter table public.preparations enable row level security;

create policy preparations_read on public.preparations for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy preparations_insert on public.preparations for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('preparations'));

create policy viewer_no_insert on public.preparations as restrictive for insert to authenticated with check (not public.is_viewer());

revoke all on public.preparations from anon;
grant select, insert on public.preparations to authenticated;

create table public.surgical_counts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  set_id text,
  patient_code text,
  expected integer,
  counted integer,
  result text,
  note text,
  at text,
  by_name text,
  signed boolean,
  extra jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index surgical_counts_org_created_idx on public.surgical_counts (organization_id, created_at desc);

create index surgical_counts_created_by_idx on public.surgical_counts (created_by);

alter table public.surgical_counts enable row level security;

create policy surgical_counts_read on public.surgical_counts for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy surgical_counts_insert on public.surgical_counts for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('counts'));

create policy viewer_no_insert on public.surgical_counts as restrictive for insert to authenticated with check (not public.is_viewer());

revoke all on public.surgical_counts from anon;
grant select, insert on public.surgical_counts to authenticated;

create table public.workflow_checkpoints (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  workflow_version integer,
  asset_id text,
  asset_kind text,
  barcode text,
  asset_name text,
  department text,
  stage_id text,
  checks jsonb,
  note text,
  completed_by_user_id text,
  completed_by_name text,
  completed_by_department text,
  completed_on text,
  extra jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index workflow_checkpoints_org_created_idx on public.workflow_checkpoints (organization_id, created_at desc);

create index workflow_checkpoints_created_by_idx on public.workflow_checkpoints (created_by);

alter table public.workflow_checkpoints enable row level security;

create policy workflow_checkpoints_read on public.workflow_checkpoints for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy workflow_checkpoints_insert on public.workflow_checkpoints for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('workflowCheckpoints'));

create policy viewer_no_insert on public.workflow_checkpoints as restrictive for insert to authenticated with check (not public.is_viewer());

revoke all on public.workflow_checkpoints from anon;
grant select, insert on public.workflow_checkpoints to authenticated;

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
$$;
revoke execute on function public.copy_legacy_records() from public, anon, authenticated;

select public.copy_legacy_records();
