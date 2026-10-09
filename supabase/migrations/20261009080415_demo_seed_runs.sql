-- Every time an evaluation Demo is filled with the sample hospital (first time, or a reset), one
-- row says when, by whom, which version of the sample, how far its dates were moved to today, and
-- how many records went in. Studio shows the latest on each Demo.
create table if not exists public.demo_seed_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('SEED', 'RESET')),
  pack_version int not null,
  shifted_days int not null,
  records int not null check (records >= 0),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists demo_seed_runs_org_idx on public.demo_seed_runs(organization_id, created_at desc);
create index if not exists demo_seed_runs_created_by_idx on public.demo_seed_runs(created_by);
alter table public.demo_seed_runs enable row level security;
create policy demo_seed_runs_owner on public.demo_seed_runs for all to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
grant select, insert on public.demo_seed_runs to authenticated;
