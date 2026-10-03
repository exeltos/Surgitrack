-- The first relational draft was never used by the app and holds no rows: it goes.
drop table if exists public.process_load_items, public.process_loads, public.recall_items, public.recall_cases,
  public.workflow_events, public.asset_photos, public.library_items, public.system_settings,
  public.role_permissions, public.workflow_versions, public.configuration_audit, public.movements,
  public.issues, public.tools, public.sets;
