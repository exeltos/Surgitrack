-- Demo hospitals are ordinary organizations flagged is_demo, so their data never mixes with real ones.
-- demo_of links a hospital's private demo copy to the real hospital (null = the built-in SurgiTrack demo).
alter table public.organizations add column if not exists is_demo boolean not null default false;
alter table public.organizations add column if not exists demo_of uuid references public.organizations(id) on delete cascade;
create unique index if not exists organizations_one_demo_per_source on public.organizations(demo_of) where demo_of is not null;
create unique index if not exists organizations_one_builtin_demo on public.organizations(is_demo) where is_demo and demo_of is null;

-- Application records stored per organization and collection, mirroring the client store.
create table if not exists public.app_records (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  collection text not null check (collection in (
    'library','sets','tools','movements','issues','counts','receipts','preparations','sterilizationCycles',
    'processLoads','recallCases','sterilizationReleases','workflowCheckpoints','deliveries')),
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, collection, id)
);
create index if not exists app_records_org_created_idx on public.app_records(organization_id, collection, created_at desc);
create index if not exists app_records_updated_by_idx on public.app_records(updated_by);
alter table public.app_records enable row level security;

-- Which collections a role may write. DEPARTMENT users may only dispatch/return assets, report issues and record counts.
create or replace function public.app_record_writable(p_collection text) returns boolean
language sql stable security definer set search_path=public as $$
 select case
   when public.is_platform_admin() then true
   when p_collection = 'library' then public."current_role"() = 'ADMIN'
   when p_collection in ('movements','issues','counts','sets','tools') then public."current_role"() is not null
   else public.is_cssd_operator()
 end
$$;
revoke execute on function public.app_record_writable(text) from public, anon;
grant execute on function public.app_record_writable(text) to authenticated;

create policy app_records_read on public.app_records for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());
-- New sets/tools can only be created by CSSD/admin; DEPARTMENT may still update their state.
create policy app_records_insert on public.app_records for insert to authenticated
  with check (
    (organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable(collection)
    and (collection not in ('sets','tools') or public.is_cssd_operator() or public.is_platform_admin()));
-- Traceability history is append-only: movements, counts and workflow records are never updated.
create policy app_records_update on public.app_records for update to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin())
    and collection in ('library','sets','tools','issues','processLoads','recallCases')
    and public.app_record_writable(collection))
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and collection in ('library','sets','tools','issues','processLoads','recallCases')
    and public.app_record_writable(collection));
-- Only assets can be deleted (CSSD/admin), issues by admins; history is never deleted via the API.
create policy app_records_delete on public.app_records for delete to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin())
    and ((collection in ('sets','tools') and (public.is_cssd_operator() or public.is_platform_admin()))
      or (collection = 'issues' and (public."current_role"() = 'ADMIN' or public.is_platform_admin()))));

-- Returns (creating on first use) the demo organization: the built-in demo, or a hospital's private demo copy.
create or replace function public.platform_ensure_demo_organization(p_source uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare v uuid; s public.organizations;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if p_source is null then
    select id into v from public.organizations where is_demo and demo_of is null;
    if v is null then
      insert into public.organizations(name, code, active, demo_enabled, is_demo)
      values ('SurgiTrack Demo', 'SURGITRACK-DEMO', true, true, true) returning id into v;
    end if;
    return v;
  end if;
  select * into s from public.organizations where id = p_source and not is_demo;
  if s.id is null then raise exception 'organization not found'; end if;
  select id into v from public.organizations where demo_of = p_source;
  if v is null then
    insert into public.organizations(name, code, active, demo_enabled, is_demo, demo_of)
    values (s.name || ' · Demo', s.code || '-DEMO', true, true, true, p_source) returning id into v;
  end if;
  return v;
end $$;
revoke execute on function public.platform_ensure_demo_organization(uuid) from public, anon;
grant execute on function public.platform_ensure_demo_organization(uuid) to authenticated;

-- Wipes a demo organization's records so it is re-seeded with fresh sample data. Never touches real hospitals.
create or replace function public.platform_reset_demo_organization(p_org uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.organizations where id = p_org and is_demo) then
    raise exception 'not a demo organization';
  end if;
  delete from public.app_records where organization_id = p_org;
end $$;
revoke execute on function public.platform_reset_demo_organization(uuid) from public, anon;
grant execute on function public.platform_reset_demo_organization(uuid) to authenticated;
