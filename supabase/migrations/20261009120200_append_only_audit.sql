-- The configuration history (Studio changes, role settings, sterilization workflow versions) kept by
-- the database, where no device can rewrite or shorten it.
--
-- Until now the history lived only inside the hospital's settings row (hospital_settings:
-- configuration_audit, role_permission_audit, workflow_versions), which the admin's device writes
-- whole and caps at 500 / 100 / 100 entries; any admin client could rewrite or empty it.
-- From now on every entry that appears in one of those arrays is also copied, server side, into
-- configuration_audit: one row per entry, never updated or deleted by anyone signed in. An entry the
-- device later drops or edits in the array stays here as it was first saved.
-- (Client follow-up, not in this change: Studio reads the history from this table instead of the
-- arrays, and the arrays can then be capped harder or dropped.)

create table if not exists public.configuration_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('configuration', 'role_permission', 'workflow_version')),
  -- The entry's own id in the array (or a hash of the entry when it has none): an entry is kept once.
  entry_id text not null,
  payload jsonb not null,
  recorded_by uuid default auth.uid() references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (organization_id, kind, entry_id)
);
create index if not exists configuration_audit_org_time_idx
  on public.configuration_audit (organization_id, kind, recorded_at desc);
create index if not exists configuration_audit_recorded_by_idx on public.configuration_audit (recorded_by);

alter table public.configuration_audit enable row level security;

-- The hospital's admins read their hospital's history; the platform owner reads all. Admins may add
-- entries (the trigger below adds them in any case); nobody changes or removes one.
drop policy if exists configuration_audit_read on public.configuration_audit;
create policy configuration_audit_read on public.configuration_audit for select to authenticated
  using ((organization_id = (select public.current_org_id()) and (select public."current_role"()) = 'ADMIN')
    or (select public.is_platform_admin()));
drop policy if exists configuration_audit_insert on public.configuration_audit;
create policy configuration_audit_insert on public.configuration_audit for insert to authenticated
  with check ((organization_id = (select public.current_org_id()) and (select public."current_role"()) = 'ADMIN')
    or (select public.is_platform_admin()));

revoke all on public.configuration_audit from public, anon, authenticated;
grant select, insert on public.configuration_audit to authenticated;
grant all on public.configuration_audit to service_role;

-- Who recorded an entry and when is the database's word, whatever the client sends.
create or replace function public.stamp_configuration_audit() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if auth.uid() is not null then
    new.recorded_by := auth.uid();
  end if;
  new.recorded_at := now();
  return new;
end $fn$;
revoke execute on function public.stamp_configuration_audit() from public, anon, authenticated;
drop trigger if exists configuration_audit_stamp on public.configuration_audit;
create trigger configuration_audit_stamp before insert on public.configuration_audit
  for each row execute function public.stamp_configuration_audit();

-- New entries of the three history arrays go to configuration_audit, after each save of the
-- settings row. Entries already recorded (same id) are skipped, so a device re-sending or shortening
-- the arrays adds nothing and removes nothing.
create or replace function public.hospital_settings_to_audit() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  k record;
  fresh jsonb;
  before jsonb;
begin
  for k in
    select * from (values
      ('configuration', new.configuration_audit, case when tg_op = 'UPDATE' then old.configuration_audit end),
      ('role_permission', new.role_permission_audit, case when tg_op = 'UPDATE' then old.role_permission_audit end),
      ('workflow_version', new.workflow_versions, case when tg_op = 'UPDATE' then old.workflow_versions end)
    ) as v(kind, now_entries, old_entries)
  loop
    fresh := k.now_entries;
    before := k.old_entries;
    continue when fresh is null or jsonb_typeof(fresh) <> 'array' or fresh = before;
    insert into public.configuration_audit (organization_id, kind, entry_id, payload)
    select new.organization_id, k.kind, coalesce(e->>'id', md5(e::text)), e
      from jsonb_array_elements(fresh) e
     where not (coalesce(before, '[]'::jsonb) @> jsonb_build_array(e))
    on conflict (organization_id, kind, entry_id) do nothing;
  end loop;
  return null;
end $fn$;
revoke execute on function public.hospital_settings_to_audit() from public, anon, authenticated;
drop trigger if exists hospital_settings_audit on public.hospital_settings;
create trigger hospital_settings_audit after insert or update of configuration_audit, role_permission_audit, workflow_versions
  on public.hospital_settings for each row execute function public.hospital_settings_to_audit();

-- What the arrays hold today becomes the start of the history.
insert into public.configuration_audit (organization_id, kind, entry_id, payload, recorded_by, recorded_at)
select hs.organization_id, v.kind, coalesce(e->>'id', md5(e::text)), e, null, now()
  from public.hospital_settings hs
 cross join lateral (values
   ('configuration', hs.configuration_audit),
   ('role_permission', hs.role_permission_audit),
   ('workflow_version', hs.workflow_versions)) as v(kind, entries)
 cross join lateral jsonb_array_elements(case when jsonb_typeof(v.entries) = 'array' then v.entries else '[]'::jsonb end) e
on conflict (organization_id, kind, entry_id) do nothing;
