-- Recycle bin: a deleted Set or instrument is kept here for 30 days (its record as it was, and the
-- instruments deleted with a Set) so Sterilization and admins can restore it. One row per deletion,
-- written once; a restore or «delete for good» removes the row.
create table if not exists public.recycle_bin (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  kind text check (kind in ('SET','TOOL')),
  label text,
  detail text,
  payload jsonb,
  deleted_on text,
  deleted_by_name text,
  extra jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index if not exists recycle_bin_org_created_idx on public.recycle_bin (organization_id, created_at desc);
create index if not exists recycle_bin_created_by_idx on public.recycle_bin (created_by);

alter table public.recycle_bin enable row level security;

-- Everyone in the hospital reads; whoever may delete Sets and instruments (Sterilization, admins and the
-- platform admin) fills, empties and restores from it; viewers never write; a locked trial is read-only.
create policy recycle_bin_read on public.recycle_bin for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy recycle_bin_insert on public.recycle_bin for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('recycleBin'));

create policy recycle_bin_delete on public.recycle_bin for delete to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin())
    and (public.is_cssd_operator() or public.is_platform_admin()));

create policy viewer_no_insert on public.recycle_bin as restrictive for insert to authenticated
  with check (not public.is_viewer());

create policy viewer_no_delete on public.recycle_bin as restrictive for delete to authenticated
  using (not public.is_viewer());

create policy trial_lock on public.recycle_bin as restrictive for all to authenticated
  using (public.is_platform_admin() or not (select public.current_org_locked()))
  with check (public.is_platform_admin() or not (select public.current_org_locked()));

revoke all on public.recycle_bin from anon;
grant select, insert, delete on public.recycle_bin to authenticated;
