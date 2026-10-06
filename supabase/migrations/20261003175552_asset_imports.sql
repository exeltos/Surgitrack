-- Bulk import of Sets and instruments from a spreadsheet (Studio → Εισαγωγή). Each import is
-- logged here; its records carry the import id (extra.importBatch) so the whole import can be undone.
create table public.asset_imports (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  file_name text not null,
  sets integer not null default 0,
  tools integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_name text,
  undone_at timestamptz,
  undone_by_name text,
  primary key (organization_id, id)
);
create index asset_imports_created_by_idx on public.asset_imports (created_by);
alter table public.asset_imports enable row level security;
create policy asset_imports_read on public.asset_imports for select to authenticated using (public.is_platform_admin());
create policy asset_imports_insert on public.asset_imports for insert to authenticated with check (public.is_platform_admin());
create policy asset_imports_update on public.asset_imports for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke all on public.asset_imports from anon;
grant select, insert, update on public.asset_imports to authenticated;

-- Finding an import's records when it is undone.
create index instruments_import_idx on public.instruments (organization_id, (extra->>'importBatch'))
  where extra ? 'importBatch';
create index instrument_sets_import_idx on public.instrument_sets (organization_id, (extra->>'importBatch'))
  where extra ? 'importBatch';
