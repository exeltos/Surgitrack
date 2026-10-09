-- Errors users meet in the app (a crash, an unexpected failure, a change the server refused), so the platform
-- owner sees what breaks before anyone calls. Anyone signed in may report, viewers included (it is not hospital
-- data); only the platform owner reads and clears them. No patient data: message, where and app version only.
create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  kind text not null check (kind in ('error', 'rejection', 'render', 'sync')),
  message text not null check (length(message) between 1 and 500),
  detail text check (length(detail) <= 4000),
  route text check (length(route) <= 200),
  app_version text check (length(app_version) <= 40),
  user_agent text check (length(user_agent) <= 300)
);
create index if not exists client_errors_occurred_idx on public.client_errors (occurred_at desc);
create index if not exists client_errors_org_idx on public.client_errors (organization_id);
create index if not exists client_errors_user_idx on public.client_errors (user_id);
alter table public.client_errors enable row level security;

create policy client_errors_insert on public.client_errors for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (organization_id is null or organization_id = (select public.current_org_id())
      or (select public.is_platform_admin()))
  );
create policy client_errors_read on public.client_errors for select to authenticated
  using ((select public.is_platform_admin()));
create policy client_errors_delete on public.client_errors for delete to authenticated
  using ((select public.is_platform_admin()));
grant select, insert, delete on public.client_errors to authenticated;

-- Kept for 90 days.
create or replace function public.purge_client_errors() returns void language sql security definer
  set search_path = public as $$
  delete from public.client_errors where occurred_at < now() - interval '90 days'
$$;
revoke execute on function public.purge_client_errors() from public, anon, authenticated;

-- Every night: errors older than 90 days, and recycle bin entries older than 30 days in hospitals where
-- nobody opened the bin (purge_recycle_bin existed but nothing called it).
select cron.schedule('nightly-purge', '41 2 * * *',
  $$select public.purge_client_errors(); select public.purge_recycle_bin();$$);
