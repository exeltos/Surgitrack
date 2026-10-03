-- Phase 2: movement history and problem reports leave app_records for their own tables.
-- Dates the app shows as typed stay text (`at`, `created_on`); created_at keeps the true order.

create table public.movements (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  asset text not null,
  asset_kind text not null check (asset_kind in ('SET', 'TOOL')),
  from_location text,
  to_location text,
  status text not null,
  at text,
  by_name text,
  patient_code text,
  note text,
  extra jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create table public.issues (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  asset text not null,
  type text not null,
  status text not null check (status in ('OPEN', 'RESOLVED')),
  created_on text,
  department text,
  note text not null default '',
  photos jsonb,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index movements_org_created_idx on public.movements (organization_id, created_at desc);
create index movements_created_by_idx on public.movements (created_by);
create index issues_org_created_idx on public.issues (organization_id, created_at desc);
create index issues_org_open_idx on public.issues (organization_id) where status = 'OPEN';
create index issues_updated_by_idx on public.issues (updated_by);

-- The same rules the app_records rows had. History is written once: no update or delete.
alter table public.movements enable row level security;
alter table public.issues enable row level security;

create policy movements_read on public.movements for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());
create policy movements_insert on public.movements for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('movements'));

create policy issues_read on public.issues for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());
create policy issues_insert on public.issues for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('issues'));
create policy issues_update on public.issues for update to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable('issues'))
  with check ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable('issues'));
create policy issues_delete on public.issues for delete to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin())
    and (public."current_role"() = 'ADMIN' or public.is_platform_admin()));

create policy viewer_no_insert on public.movements as restrictive for insert to authenticated with check (not public.is_viewer());
create policy viewer_no_insert on public.issues as restrictive for insert to authenticated with check (not public.is_viewer());
create policy viewer_no_update on public.issues as restrictive for update to authenticated using (not public.is_viewer());
create policy viewer_no_delete on public.issues as restrictive for delete to authenticated using (not public.is_viewer());

revoke all on public.movements, public.issues from anon;
grant select, insert on public.movements to authenticated;
grant select, insert, update, delete on public.issues to authenticated;

create or replace function public.touch_issue_row() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
create trigger issues_touch before update on public.issues for each row execute function public.touch_issue_row();

-- Copies what is still only in app_records into the new tables. Safe to run again: history already
-- copied is left as it is; a changeable record is replaced only by a newer version. The final
-- cleanup runs it once more before app_records goes.
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
$$;
revoke execute on function public.copy_legacy_records() from public, anon, authenticated;

select public.copy_legacy_records();

-- The Demo reset and department renames are updated for these tables in the final cleanup
-- (20261003190000_finish_app_records.sql), which needs the owner to run it.
