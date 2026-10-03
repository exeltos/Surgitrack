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

-- Copies each hospital's settings document into hospital_settings (a newer version wins).
create or replace function public.copy_legacy_settings() returns void
language sql security definer set search_path = public as $$
  insert into public.hospital_settings (organization_id, id, departments, specialties, manufacturers, suppliers, tool_categories, sterilizers, color_tapes, organizations, users, role_permissions, role_permission_audit, configuration_audit, workflow_versions, sterilization_workflow, system_settings, extra, created_at, updated_at, updated_by)
  select organization_id, id, data->'departments', data->'specialties', data->'manufacturers', data->'suppliers', data->'toolCategories', data->'sterilizers', data->'colorTapes', data->'organizations', data->'users', data->'rolePermissions', data->'rolePermissionAudit', data->'configurationAudit', data->'workflowVersions', data->'sterilizationWorkflow', data->'systemSettings',
    nullif(data - array['id','departments','specialties','manufacturers','suppliers','toolCategories','sterilizers','colorTapes','organizations','users','rolePermissions','rolePermissionAudit','configurationAudit','workflowVersions','sterilizationWorkflow','systemSettings'], '{}'::jsonb), created_at, updated_at, updated_by
  from public.app_records where collection = 'library'
  on conflict (organization_id, id) do update set
    departments = excluded.departments, specialties = excluded.specialties, manufacturers = excluded.manufacturers, suppliers = excluded.suppliers, tool_categories = excluded.tool_categories, sterilizers = excluded.sterilizers, color_tapes = excluded.color_tapes, organizations = excluded.organizations, users = excluded.users, role_permissions = excluded.role_permissions, role_permission_audit = excluded.role_permission_audit, configuration_audit = excluded.configuration_audit, workflow_versions = excluded.workflow_versions, sterilization_workflow = excluded.sterilization_workflow, system_settings = excluded.system_settings, extra = excluded.extra
  where excluded.updated_at > public.hospital_settings.updated_at;
$$;
revoke execute on function public.copy_legacy_settings() from public, anon, authenticated;

-- Writes from a browser still on an older build reach the new tables, settings included.
create or replace function public.forward_legacy_records() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.copy_legacy_records();
  perform public.copy_legacy_settings();
  return null;
end $$;

select public.copy_legacy_settings();
