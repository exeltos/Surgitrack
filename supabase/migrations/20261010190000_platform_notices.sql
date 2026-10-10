-- Notices the platform owner shows to every signed-in user (Studio → Ειδοποιήσεις), kept as a list:
-- each has its own message and window (from / until), and stays in the list after it ends. Replaces the
-- single maintenance notice of platform_settings (its columns stay, unused, for clients not yet updated).
create table if not exists public.platform_notices (
  id uuid primary key default gen_random_uuid(),
  message text not null check (length(btrim(message)) between 1 and 300),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_by_name text,
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists platform_notices_ends_idx on public.platform_notices (ends_at desc nulls first);

alter table public.platform_notices enable row level security;
-- Everyone signed in reads them (the app shows the current ones); only the platform owner writes.
create policy platform_notices_read on public.platform_notices for select to authenticated using (true);
create policy platform_notices_write on public.platform_notices for all to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
grant select, insert, update, delete on public.platform_notices to authenticated;

-- The notice set the old way carries over.
insert into public.platform_notices (message, ends_at)
select btrim(maintenance_message), maintenance_until
from public.platform_settings
where nullif(btrim(maintenance_message), '') is not null
  and (maintenance_until is null or maintenance_until > now())
  and not exists (select 1 from public.platform_notices);
