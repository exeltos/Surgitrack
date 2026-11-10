-- The state of a sterilizer or washer that Sterilization staff keep up every day: whether it is out of service (a
-- breakdown or maintenance) and its tests (Bowie-Dick, leak, spores). It lives apart from the hospital's library
-- (Studio › Libraries, which only administrators write), so the staff who run the machines can record it.
--
-- One row per hospital and equipment name. Reading is for the hospital's people; writing is for Sterilization staff and
-- administrators (never viewers or departments), and the platform owner.
create table if not exists public.equipment_status (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  -- {reason: BREAKDOWN | MAINTENANCE, note, since, by} or null when in service.
  out_of_service jsonb check (out_of_service is null or jsonb_typeof(out_of_service) = 'object'),
  -- The latest tests, newest first.
  tests jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tests) = 'array' and jsonb_array_length(tests) <= 200),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, name)
);
create index if not exists equipment_status_updated_by_idx on public.equipment_status(updated_by);

alter table public.equipment_status enable row level security;
revoke all on public.equipment_status from anon, public;
grant select, insert, update on public.equipment_status to authenticated;

create policy equipment_status_read on public.equipment_status for select to authenticated
  using (organization_id = (select public.current_org_id()) or (select public.is_platform_admin()));
create policy equipment_status_insert on public.equipment_status for insert to authenticated
  with check (
    (select public.is_platform_admin())
    or (organization_id = (select public.current_org_id()) and (select public.is_cssd_operator()))
  );
create policy equipment_status_update on public.equipment_status for update to authenticated
  using (
    (select public.is_platform_admin())
    or (organization_id = (select public.current_org_id()) and (select public.is_cssd_operator()))
  )
  with check (
    (select public.is_platform_admin())
    or (organization_id = (select public.current_org_id()) and (select public.is_cssd_operator()))
  );
