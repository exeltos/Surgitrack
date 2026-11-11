-- Who is connected right now, and blocking an address (the platform owner's security view).
--
-- The app tells the database every minute that its person is there (touch_presence): who, from which address (the
-- one the API gateway saw, which the client cannot set) and with which browser. The owner reads the people seen in
-- the last minutes (platform_active_sessions) with their addresses, and can block an address: from then on
-- every row security policy shows that address none of any hospital's data (ip_blocked, the same switch the
-- hospital's own allowed addresses use) and the app turns it away at its next minute. The platform owner is never
-- held to a block, so it can always be undone. A single person is stopped with platform_set_profile_access.
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  ip text,
  user_agent text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists user_presence_last_seen on public.user_presence (last_seen desc);
create index if not exists user_presence_org on public.user_presence (organization_id);
alter table public.user_presence enable row level security;
revoke all on public.user_presence from anon, authenticated;
grant select on public.user_presence to authenticated;
drop policy if exists user_presence_owner_read on public.user_presence;
create policy user_presence_owner_read on public.user_presence for select to authenticated
  using ((select public.is_platform_admin()));

create table if not exists public.blocked_ips (
  ip inet primary key,
  note text check (note is null or length(note) <= 200),
  blocked_at timestamptz not null default now(),
  blocked_by uuid
);
alter table public.blocked_ips enable row level security;
revoke all on public.blocked_ips from anon, authenticated;
grant select on public.blocked_ips to authenticated;
drop policy if exists blocked_ips_owner_read on public.blocked_ips;
create policy blocked_ips_owner_read on public.blocked_ips for select to authenticated
  using ((select public.is_platform_admin()));

-- A blocked address works in no hospital, whatever the hospital's own rule says.
create or replace function public.ip_blocked(p_org uuid, p_uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select (public.request_ip() is not null
          and exists (select 1 from public.blocked_ips b where public.request_ip() <<= b.ip))
      or coalesce((
    select a.mode = 'ENFORCE'
       and public.request_ip() is not null
       and not (p_uid = any (a.exempt_users))
       and not exists (
         select 1 from jsonb_array_elements(a.addresses) e where public.request_ip() <<= (e->>'ip')::inet)
      from public.ip_access a where a.organization_id = p_org), false)
$$;
revoke execute on function public.ip_blocked(uuid, uuid) from public, anon, authenticated;

-- What the app asks after sign-in: a blocked address is turned away like one outside a hospital's allowed ones.
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
  if v_ip is not null and not public.is_platform_admin()
     and exists (select 1 from public.blocked_ips b where v_ip <<= b.ip) then
    if v_org is not null and not exists (
      select 1 from public.ip_access_log l
       where l.organization_id = v_org and l.user_id = auth.uid() and l.ip = host(v_ip) and l.at > now() - interval '1 hour') then
      insert into public.ip_access_log (organization_id, user_id, ip, blocked) values (v_org, auth.uid(), host(v_ip), true);
    end if;
    return json_build_object('mode', 'ENFORCE', 'allowed', false, 'ip', host(v_ip));
  end if;
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

-- The app's minute: «I am here». Answers whether this address may stay (false when it is blocked).
create or replace function public.touch_presence(p_agent text default null)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  v_ip inet := public.request_ip();
  v_org uuid;
  v_blocked boolean;
begin
  if auth.uid() is null then return json_build_object('allowed', true); end if;
  select organization_id into v_org from public.profiles where id = auth.uid();
  v_blocked := v_ip is not null and not public.is_platform_admin()
    and exists (select 1 from public.blocked_ips b where v_ip <<= b.ip);
  insert into public.user_presence (user_id, organization_id, ip, user_agent, first_seen, last_seen)
  values (auth.uid(), v_org, host(v_ip), left(p_agent, 300), now(), now())
  on conflict (user_id) do update
    set organization_id = excluded.organization_id,
        ip = excluded.ip,
        user_agent = excluded.user_agent,
        first_seen = case when public.user_presence.last_seen < now() - interval '10 minutes'
                          then now() else public.user_presence.first_seen end,
        last_seen = now();
  return json_build_object('allowed', not v_blocked, 'ip', host(v_ip));
end $$;
revoke execute on function public.touch_presence(text) from public, anon;
grant execute on function public.touch_presence(text) to authenticated;

-- The people seen in the last minutes, newest first (the platform owner only).
create or replace function public.platform_active_sessions(p_minutes integer default 5)
returns table (
  user_id uuid, name text, email text, role text, organization_id uuid, organization_name text,
  active boolean, ip text, ip_blocked boolean, user_agent text, first_seen timestamptz, last_seen timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only the platform owner reads this' using errcode = '42501';
  end if;
  return query
    select up.user_id, coalesce(pr.name, '—'), coalesce(pr.email, ''), pr.role::text, pr.organization_id, o.name,
           coalesce(pr.active, true), up.ip,
           (up.ip is not null and exists (select 1 from public.blocked_ips b where up.ip::inet <<= b.ip)),
           up.user_agent, up.first_seen, up.last_seen
      from public.user_presence up
      left join public.profiles pr on pr.id = up.user_id
      left join public.organizations o on o.id = pr.organization_id
     where up.last_seen > now() - make_interval(mins => greatest(1, least(coalesce(p_minutes, 5), 60)))
     order by up.last_seen desc;
end $$;
revoke execute on function public.platform_active_sessions(integer) from public, anon;
grant execute on function public.platform_active_sessions(integer) to authenticated;

-- Blocking and unblocking an address (a range narrower than a /24, or /48 for IPv6, is refused: not a whole network).
create or replace function public.platform_block_ip(p_ip inet, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only the platform owner blocks addresses' using errcode = '42501';
  end if;
  if p_ip is null or masklen(p_ip) < (case when family(p_ip) = 4 then 24 else 48 end) then
    raise exception 'block one address or a small range, not a whole network' using errcode = '22023';
  end if;
  insert into public.blocked_ips (ip, note, blocked_at, blocked_by)
  values (p_ip, nullif(left(btrim(coalesce(p_note, '')), 200), ''), now(), auth.uid())
  on conflict (ip) do update set note = excluded.note, blocked_at = now(), blocked_by = auth.uid();
end $$;
revoke execute on function public.platform_block_ip(inet, text) from public, anon;
grant execute on function public.platform_block_ip(inet, text) to authenticated;

create or replace function public.platform_unblock_ip(p_ip inet)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only the platform owner unblocks addresses' using errcode = '42501';
  end if;
  delete from public.blocked_ips where ip = p_ip;
end $$;
revoke execute on function public.platform_unblock_ip(inet) from public, anon;
grant execute on function public.platform_unblock_ip(inet) to authenticated;
