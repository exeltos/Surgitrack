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
