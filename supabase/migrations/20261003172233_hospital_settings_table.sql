-- Phase 5: each hospital's settings (libraries, color tapes, role permissions, sterilization
-- workflow and its versions, configuration history) leave app_records for hospital_settings: one
-- row per hospital (id 'state'), one column per section.

create table public.hospital_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  departments jsonb,
  specialties jsonb,
  manufacturers jsonb,
  suppliers jsonb,
  tool_categories jsonb,
  sterilizers jsonb,
  color_tapes jsonb,
  organizations jsonb,
  users jsonb,
  role_permissions jsonb,
  role_permission_audit jsonb,
  configuration_audit jsonb,
  workflow_versions jsonb,
  sterilization_workflow jsonb,
  system_settings jsonb,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index hospital_settings_updated_by_idx on public.hospital_settings (updated_by);

alter table public.hospital_settings enable row level security;

create policy hospital_settings_read on public.hospital_settings for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy hospital_settings_insert on public.hospital_settings for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('library'));

create policy viewer_no_insert on public.hospital_settings as restrictive for insert to authenticated with check (not public.is_viewer());

create policy hospital_settings_update on public.hospital_settings for update to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable('library'))
  with check ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable('library'));

create policy viewer_no_update on public.hospital_settings as restrictive for update to authenticated using (not public.is_viewer());

create trigger hospital_settings_touch before update on public.hospital_settings for each row execute function public.touch_updated_row();

revoke all on public.hospital_settings from anon;
grant select, insert, update on public.hospital_settings to authenticated;

