-- Access by network: a hospital can let its people in only from the addresses of its own networks.
--
-- The platform owner sets it per hospital (Studio -> the hospital's actions -> «Πρόσβαση ανά δίκτυο»): a mode
-- (OFF; LOG, which blocks nobody and records who would have been blocked; ENFORCE), the allowed addresses (a single
-- address or a range such as 203.0.113.0/28) and the people exempt from it. The platform owner is never held to it.
--
-- It is enforced in the database, like the first-password rule: while a person is outside the allowed addresses
-- current_org_id() is null, so every row security policy shows them none of the hospital's data and lets them write
-- none. The address is the one the API gateway saw (cf-connecting-ip, which the client cannot set). Realtime has no
-- request headers: an unknown address is never blocked, so live updates keep flowing.
create table if not exists public.ip_access (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  mode text not null default 'OFF' check (mode in ('OFF', 'LOG', 'ENFORCE')),
  addresses jsonb not null default '[]'::jsonb,
  exempt_users uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.ip_access enable row level security;
revoke all on public.ip_access from anon, authenticated;
grant select on public.ip_access to authenticated;
create policy ip_access_owner_read on public.ip_access for select to authenticated
  using ((select public.is_platform_admin()));

-- Who was (or, in LOG mode, would have been) kept out: one row per person and address an hour.
create table if not exists public.ip_access_log (
  id bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  ip text,
  blocked boolean not null,
  at timestamptz not null default now()
);
create index if not exists ip_access_log_org_at on public.ip_access_log (organization_id, at desc);
alter table public.ip_access_log enable row level security;
revoke all on public.ip_access_log from anon, authenticated;
grant select on public.ip_access_log to authenticated;
create policy ip_access_log_owner_read on public.ip_access_log for select to authenticated
  using ((select public.is_platform_admin()));

-- The caller's address as the gateway saw it; null when the request carries no headers (Realtime, a direct
-- database connection) or the header is not an address.
create or replace function public.request_ip()
returns inet
language plpgsql stable set search_path = public as $$
declare
  h json;
  v text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    h := null;
  end;
  if h is null then return null; end if;
  v := nullif(btrim(h->>'cf-connecting-ip'), '');
  if v is null then v := nullif(btrim(split_part(coalesce(h->>'x-real-ip', ''), ',', 1)), ''); end if;
  if v is null then
    -- the entry the proxy appended, the last one: the first is whatever the client wrote
    select nullif(btrim(e), '') into v
      from unnest(string_to_array(coalesce(h->>'x-forwarded-for', ''), ',')) with ordinality t(e, n)
      order by n desc limit 1;
  end if;
  return v::inet;
exception when others then
  return null;
end $$;
revoke execute on function public.request_ip() from public, anon, authenticated;

-- Whether this person is outside their hospital's allowed addresses and the hospital enforces them.
create or replace function public.ip_blocked(p_org uuid, p_uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select a.mode = 'ENFORCE'
       and public.request_ip() is not null
       and not (p_uid = any (a.exempt_users))
       and not exists (
         select 1 from jsonb_array_elements(a.addresses) e where public.request_ip() <<= (e->>'ip')::inet)
      from public.ip_access a where a.organization_id = p_org), false)
$$;
revoke execute on function public.ip_blocked(uuid, uuid) from public, anon, authenticated;

-- The hospital is theirs only from an allowed address (the platform owner has no hospital, so is never held).
create or replace function public.current_org_id()
returns uuid
language sql stable security definer set search_path to 'public' as $$
  select p.organization_id from public.profiles p
   where p.id = auth.uid() and p.active = true and not p.password_change_required
     and not public.ip_blocked(p.organization_id, p.id)
$$;

-- What the app asks after sign-in: the mode, whether this address is allowed, and the address seen. A refused
-- address (and, in LOG mode, one that would be) is recorded once an hour per person.
create or replace function public.my_ip_access()
returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  v_org uuid;
  v_ip inet := public.request_ip();
  a public.ip_access;
  v_allowed boolean;
begin
  select organization_id into v_org from public.profiles where id = auth.uid() and active;
  select * into a from public.ip_access where organization_id = v_org;
  if v_org is null or not found or a.mode = 'OFF' then
    return json_build_object('mode', coalesce(a.mode, 'OFF'), 'allowed', true, 'ip', host(v_ip));
  end if;
  v_allowed := v_ip is null
    or auth.uid() = any (a.exempt_users)
    or exists (select 1 from jsonb_array_elements(a.addresses) e where v_ip <<= (e->>'ip')::inet);
  if not v_allowed and not exists (
    select 1 from public.ip_access_log l
     where l.organization_id = v_org and l.user_id = auth.uid() and l.ip = host(v_ip) and l.at > now() - interval '1 hour') then
    insert into public.ip_access_log (organization_id, user_id, ip, blocked)
    values (v_org, auth.uid(), host(v_ip), a.mode = 'ENFORCE');
  end if;
  return json_build_object('mode', a.mode, 'allowed', v_allowed, 'ip', host(v_ip));
end $$;
revoke execute on function public.my_ip_access() from public, anon;
grant execute on function public.my_ip_access() to authenticated;

-- The platform owner sets a hospital's rule.
create or replace function public.platform_set_ip_access(p_org uuid, p_mode text, p_addresses jsonb, p_exempt uuid[])
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  e jsonb;
  v_clean jsonb := '[]'::jsonb;
  v_exempt uuid[];
begin
  if not public.is_platform_admin() then
    raise exception 'only the platform owner sets this' using errcode = '42501';
  end if;
  if p_mode not in ('OFF', 'LOG', 'ENFORCE') then raise exception 'unknown mode' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_addresses, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_addresses, '[]'::jsonb)) > 50 then
    raise exception 'addresses must be a list of at most 50' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(coalesce(p_addresses, '[]'::jsonb)) loop
    begin
      v_clean := v_clean || jsonb_build_array(jsonb_build_object(
        'ip', (btrim(e->>'ip'))::inet::text, 'label', left(coalesce(e->>'label', ''), 80)));
    exception when others then
      raise exception 'not an address: %', coalesce(e->>'ip', '') using errcode = '22023';
    end;
  end loop;
  if p_mode = 'ENFORCE' and jsonb_array_length(v_clean) = 0 then
    raise exception 'enforcing needs at least one address' using errcode = '22023';
  end if;
  select coalesce(array_agg(id), '{}') into v_exempt
    from public.profiles where id = any (coalesce(p_exempt, '{}')) and organization_id = p_org;
  insert into public.ip_access (organization_id, mode, addresses, exempt_users, updated_at, updated_by)
  values (p_org, p_mode, v_clean, v_exempt, now(), auth.uid())
  on conflict (organization_id) do update
    set mode = excluded.mode, addresses = excluded.addresses, exempt_users = excluded.exempt_users,
        updated_at = now(), updated_by = auth.uid();
end $$;
revoke execute on function public.platform_set_ip_access(uuid, text, jsonb, uuid[]) from public, anon;
grant execute on function public.platform_set_ip_access(uuid, text, jsonb, uuid[]) to authenticated;

-- The nightly purge also clears this log of rows older than 90 days.
create or replace function public.purge_ip_access_log()
returns void
language sql volatile security definer set search_path = public as $$
  delete from public.ip_access_log where at < now() - interval '90 days'
$$;
revoke execute on function public.purge_ip_access_log() from public, anon, authenticated;

select cron.schedule('nightly-purge', '41 2 * * *',
  $$select public.purge_client_errors(); select public.purge_recycle_bin(); select public.purge_login_attempts(); select public.purge_ip_access_log();$$);
