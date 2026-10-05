create extension if not exists pgcrypto;

create type public.surgi_role as enum ('ADMIN','STERILIZATION','DEPARTMENT');
create type public.asset_state as enum ('IN_DEPARTMENT','PENDING_STERILIZATION','IN_WASHING','IN_PREPARATION','IN_PACKAGING','IN_STERILIZATION','AWAITING_RELEASE','IN_STORAGE','READY_FOR_PICKUP','IN_STOCK','SERVICE','LOST');
create type public.tool_mode as enum ('STANDALONE','SET_MEMBER','STOCK');

create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null, code text not null unique,
 active boolean not null default true, demo_enabled boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.departments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null, code text, active boolean not null default true, created_at timestamptz not null default now(),
 unique(organization_id,name)
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 organization_id uuid references public.organizations(id) on delete restrict,
 department_id uuid references public.departments(id) on delete set null,
 name text not null, email text not null, role public.surgi_role not null,
 active boolean not null default true, demo_enabled boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.role_permissions (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 role public.surgi_role not null, permission text not null,
 primary key(organization_id,role,permission)
);
create table public.library_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 library_key text not null check (library_key in ('specialties','manufacturers','suppliers','toolCategories','sterilizers')),
 name text not null, code text, active boolean not null default true, created_at timestamptz not null default now(),
 unique(organization_id,library_key,name)
);
create table public.sets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 department_id uuid references public.departments(id) on delete set null,
 barcode text not null, legacy_barcodes text[] not null default '{}', code text not null, name text not null,
 specialty text not null default '', manufacturer text, state public.asset_state not null default 'IN_STOCK',
 expected integer not null default 0 check(expected>=0), actual integer not null default 0 check(actual>=0),
 patient_code text, category text, notes text, uses integer not null default 0 check(uses>=0),
 max_uses integer check(max_uses is null or max_uses>0), composition_template jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,barcode)
);
create table public.tools (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 department_id uuid references public.departments(id) on delete set null,
 set_id uuid references public.sets(id) on delete set null,
 barcode text not null, legacy_barcodes text[] not null default '{}', code text not null, name text not null,
 specialty text not null default '', manufacturer text, mode public.tool_mode not null default 'STOCK',
 state public.asset_state not null default 'IN_STOCK', max_uses integer check(max_uses is null or max_uses>0),
 uses integer not null default 0 check(uses>=0), sterilizations integer not null default 0 check(sterilizations>=0),
 serial_number text, purchase_date date, warranty_until date, cost numeric(12,2), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,barcode)
);
create table public.asset_photos (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 asset_kind text not null check(asset_kind in ('SET','TOOL')), asset_id uuid not null,
 storage_path text not null, name text not null, created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
create table public.movements (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 asset_id uuid not null, asset_kind text not null check(asset_kind in ('SET','TOOL')),
 asset_label text not null, from_location text not null, to_location text not null, status text not null,
 occurred_at timestamptz not null default now(), performed_by uuid references public.profiles(id) on delete set null,
 performed_by_name text not null, patient_code text, note text
);
create table public.issues (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 asset_id uuid not null, asset_kind text not null check(asset_kind in ('SET','TOOL')), asset_label text not null,
 type text not null, status text not null check(status in ('OPEN','RESOLVED')) default 'OPEN',
 department_id uuid references public.departments(id) on delete set null, note text not null default '',
 created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(),
 resolved_at timestamptz, resolution_note text
);
create table public.workflow_versions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 version integer not null check(version>0), profile_name text not null, effective_from timestamptz,
 changed_by uuid references public.profiles(id) on delete set null, change_reason text, snapshot jsonb not null,
 created_at timestamptz not null default now(), unique(organization_id,version)
);
create table public.process_loads (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 workflow_version integer not null, kind text not null check(kind in ('WASHING','STERILIZATION')),
 equipment text not null, cycle_number text not null, program text not null, status text not null,
 chemical_indicator_result text, biological_indicator_result text, physical_parameters_ok boolean,
 packaging_integrity_ok boolean, note text, created_by uuid references public.profiles(id) on delete set null,
 created_by_name text not null, created_at timestamptz not null default now(), completed_at timestamptz,
 released_at timestamptz, recalled_at timestamptz, recall_reason text
);
create table public.process_load_items (
 load_id uuid not null references public.process_loads(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete restrict,
 asset_id uuid not null, asset_kind text not null check(asset_kind in ('SET','TOOL')),
 barcode text not null, asset_name text not null, department_id uuid references public.departments(id) on delete set null,
 primary key(load_id,asset_kind,asset_id)
);
create table public.workflow_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 workflow_version integer not null, event_type text not null check(event_type in ('RECEIPT','PREPARATION','CYCLE','RELEASE','CHECKPOINT','DELIVERY','COUNT')),
 asset_id uuid not null, asset_kind text not null check(asset_kind in ('SET','TOOL')), barcode text not null, asset_name text not null,
 department_id uuid references public.departments(id) on delete set null, load_id uuid references public.process_loads(id) on delete set null,
 payload jsonb not null default '{}'::jsonb, performed_by uuid references public.profiles(id) on delete set null,
 performed_by_name text not null, occurred_at timestamptz not null default now()
);
create table public.recall_cases (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 load_id uuid not null references public.process_loads(id) on delete restrict, cycle_number text not null, sterilizer text not null,
 reason text not null, status text not null check(status in ('OPEN','CLOSED')) default 'OPEN',
 opened_by uuid references public.profiles(id) on delete set null, opened_by_name text not null,
 opened_at timestamptz not null default now(), closed_at timestamptz
);
create table public.recall_items (
 recall_id uuid not null references public.recall_cases(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete restrict,
 asset_id uuid not null, asset_kind text not null check(asset_kind in ('SET','TOOL')), barcode text not null, asset_name text not null,
 current_state public.asset_state not null, patient_code text,
 status text not null check(status in ('OUTSTANDING','RETURNED','REPROCESSING','CLOSED')) default 'OUTSTANDING',
 returned_at timestamptz, primary key(recall_id,asset_kind,asset_id)
);
create table public.configuration_audit (
 id bigint generated always as identity primary key, organization_id uuid references public.organizations(id) on delete restrict,
 entity_type text not null, entity_id text not null, action text not null,
 occurred_at timestamptz not null default now(), actor_id uuid references public.profiles(id) on delete set null,
 actor_name text, before_data jsonb, after_data jsonb, reason text
);
create table public.system_settings (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 usage_warning_threshold integer not null default 3 check(usage_warning_threshold>=0), updated_at timestamptz not null default now()
);

create index sets_org_state_idx on public.sets(organization_id,state);
create index tools_org_state_idx on public.tools(organization_id,state);
create index tools_set_idx on public.tools(set_id);
create index movements_org_time_idx on public.movements(organization_id,occurred_at desc);
create index issues_org_status_idx on public.issues(organization_id,status);
create index loads_org_time_idx on public.process_loads(organization_id,created_at desc);
create index events_asset_time_idx on public.workflow_events(organization_id,asset_kind,asset_id,occurred_at desc);

create or replace function public.current_org_id() returns uuid language sql stable security definer set search_path=public as $$
 select organization_id from public.profiles where id=auth.uid() and active=true
$$;
create or replace function public.current_role() returns public.surgi_role language sql stable security definer set search_path=public as $$
 select role from public.profiles where id=auth.uid() and active=true
$$;
create or replace function public.current_department_id() returns uuid language sql stable security definer set search_path=public as $$
 select department_id from public.profiles where id=auth.uid() and active=true
$$;
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active=true and role='ADMIN' and organization_id is null)
$$;

alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.library_items enable row level security;
alter table public.sets enable row level security;
alter table public.tools enable row level security;
alter table public.asset_photos enable row level security;
alter table public.movements enable row level security;
alter table public.issues enable row level security;
alter table public.workflow_versions enable row level security;
alter table public.process_loads enable row level security;
alter table public.process_load_items enable row level security;
alter table public.workflow_events enable row level security;
alter table public.recall_cases enable row level security;
alter table public.recall_items enable row level security;
alter table public.configuration_audit enable row level security;
alter table public.system_settings enable row level security;

create policy org_read on public.organizations for select to authenticated using (id=public.current_org_id() or public.is_platform_admin());
create policy org_admin on public.organizations for all to authenticated using (public.is_platform_admin() or (id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (id=public.current_org_id() and public.current_role()='ADMIN'));

create policy dept_read on public.departments for select to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy dept_admin on public.departments for all to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

create policy profiles_read on public.profiles for select to authenticated using (id=auth.uid() or organization_id=public.current_org_id() or public.is_platform_admin());
create policy profiles_admin on public.profiles for all to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

create policy rp_read on public.role_permissions for select to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy rp_admin on public.role_permissions for all to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

create policy lib_read on public.library_items for select to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy lib_admin on public.library_items for all to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

create policy sets_read on public.sets for select to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy sets_write on public.sets for all to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin()) with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy tools_read on public.tools for select to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy tools_write on public.tools for all to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin()) with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy photos_rw on public.asset_photos for all to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin()) with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy movements_read on public.movements for select to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy movements_insert on public.movements for insert to authenticated with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy issues_rw on public.issues for all to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin()) with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy wfv_read on public.workflow_versions for select to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy wfv_admin on public.workflow_versions for all to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));
create policy loads_rw on public.process_loads for all to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin()) with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy loaditems_rw on public.process_load_items for all to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin()) with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy events_read on public.workflow_events for select to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy events_insert on public.workflow_events for insert to authenticated with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy recalls_rw on public.recall_cases for all to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin()) with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy recallitems_rw on public.recall_items for all to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin()) with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy audit_read on public.configuration_audit for select to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy audit_insert on public.configuration_audit for insert to authenticated with check (organization_id=public.current_org_id() or public.is_platform_admin());
create policy settings_read on public.system_settings for select to authenticated using (organization_id=public.current_org_id() or public.is_platform_admin());
create policy settings_admin on public.system_settings for all to authenticated using (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN')) with check (public.is_platform_admin() or (organization_id=public.current_org_id() and public.current_role()='ADMIN'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('surgitrack-assets','surgitrack-assets',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
