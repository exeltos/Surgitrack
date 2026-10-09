-- Demo accounts for prospects. The platform owner opens, from Studio, an evaluation Demo for a
-- hospital that wants to try SurgiTrack: its own isolated Demo hospital (is_demo, evaluation),
-- filled with sample data, with a real admin account for the prospect. It runs as a trial
-- (plan TRIAL, trial_ends_at), so the existing trial lock closes it on its last day.

-- An evaluation Demo is a Demo hospital that real people sign in to (the built-in SurgiTrack Demo
-- and a hospital's private demo copy are only entered by the platform owner).
alter table public.organizations add column if not exists evaluation boolean not null default false;

-- There is still one built-in Demo; evaluation Demos are as many as the owner opens.
drop index if exists public.organizations_one_builtin_demo;
create unique index organizations_one_builtin_demo on public.organizations(is_demo)
  where is_demo and demo_of is null and not evaluation;

-- The built-in Demo is found among the Demo hospitals that are not evaluation Demos.
create or replace function public.platform_ensure_demo_organization(p_source uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare v uuid; s public.organizations;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if p_source is null then
    select id into v from public.organizations where is_demo and demo_of is null and not evaluation;
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

-- One row per evaluation Demo: who it is for and how far its preparation has got.
--  PREPARING: the hospital exists; its sample data or the invitation is still to come.
--  SENT: the prospect has the email with their username and the set-password button.
create table if not exists public.demo_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  hospital_name text not null check (length(trim(hospital_name)) between 2 and 120),
  contact_name text not null check (length(trim(contact_name)) between 2 and 120),
  contact_email text not null check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone text,
  notes text,
  status text not null default 'PREPARING' check (status in ('PREPARING', 'SENT')),
  -- How many colleagues the prospect may add to their Demo (enforced from the next phase).
  max_extra_users int not null default 5 check (max_extra_users between 0 and 50),
  seeded_at timestamptz,
  evaluator_id uuid references auth.users(id) on delete set null,
  invited_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demo_accounts_created_by_idx on public.demo_accounts(created_by);
create index if not exists demo_accounts_evaluator_idx on public.demo_accounts(evaluator_id);
alter table public.demo_accounts enable row level security;
-- The owner manages them; the people of a Demo read their own row (its user limit).
create policy demo_accounts_owner on public.demo_accounts for all to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy demo_accounts_own_read on public.demo_accounts for select to authenticated
  using (organization_id = (select public.current_org_id()));
revoke all on public.demo_accounts from anon;
grant select, insert, update, delete on public.demo_accounts to authenticated;

-- Opens an evaluation Demo in one step: the Demo hospital (a trial ending on p_ends_at), the
-- departments the sample data uses, and the Demo's row. The sample data and the invitation
-- follow from Studio; until both are done the Demo stays PREPARING.
create or replace function public.platform_create_demo_account(
  p_hospital text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_ends_at timestamptz,
  p_notes text default null
) returns json
language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_account uuid; v_code text; v_email text := lower(trim(p_contact_email));
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if p_ends_at is null or p_ends_at <= now() then raise exception 'end date must be in the future'; end if;
  if p_ends_at > now() + interval '366 days' then raise exception 'end date too far'; end if;
  if exists (select 1 from public.profiles where lower(email) = v_email) then
    raise exception 'email already registered';
  end if;
  loop
    v_code := 'DEMO-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.organizations where code = v_code);
  end loop;
  insert into public.organizations(name, code, active, demo_enabled, is_demo, evaluation, plan, trial_ends_at)
  values (trim(p_hospital) || ' · Demo', v_code, true, false, true, true, 'TRIAL', p_ends_at)
  returning id into v_org;
  -- The departments of the sample hospital, by the names its records use.
  insert into public.departments(organization_id, name, code, active)
  select v_org, d.name, d.code, true
    from (values
      ('Κεντρική Αποστείρωση', 'STER'), ('Χειρουργείο', 'OR'), ('Ορθοπεδική Κλινική', 'ORTHO'),
      ('Γυναικολογική Κλινική', 'GYN'), ('Αίθουσα Τοκετών', 'DEL'), ('Μονάδα IVF', 'IVF'),
      ('ΜΕΘ', 'ICU'), ('ΤΕΠ', 'ED'), ('Βιοϊατρική Υπηρεσία', 'BIO'), ('Προμήθειες', 'PROC')
    ) as d(name, code);
  insert into public.demo_accounts(organization_id, hospital_name, contact_name, contact_email, contact_phone, notes)
  values (v_org, trim(p_hospital), trim(p_contact_name), v_email, nullif(trim(p_contact_phone), ''), nullif(trim(p_notes), ''))
  returning id into v_account;
  return json_build_object('id', v_account, 'organization_id', v_org, 'code', v_code);
end $$;
revoke execute on function public.platform_create_demo_account(text, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.platform_create_demo_account(text, text, text, text, timestamptz, text) to authenticated;
