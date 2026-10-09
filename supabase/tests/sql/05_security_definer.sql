-- Functions that run with their owner's rights (security definer) are the database's sharpest tools.
-- Each one pins its search_path, and the ones signed-in users may call are exactly the reviewed list
-- below (supabase/SECURITY_DEFINER.md says what each is for). A new one fails here until it is reviewed
-- and added to both.
begin;
\ir ../local/fixtures.sql

select tests.eq((
  select string_agg(p.proname, ',' order by p.proname) from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  null, 'every security definer function pins its search_path');

select tests.eq((
  select string_agg(p.proname, ',' order by p.proname) from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosecdef
     and has_function_privilege('authenticated', p.oid, 'execute')),
  'app_record_writable,can_import_assets,claim_platform_admin,current_org_id,current_org_locked,'
  'current_role,demo_seats_left,hospital_create_signup_link,hospital_decide_access_request,'
  'hospital_revoke_signup_links,is_asset_manager,is_cssd_operator,is_org_admin,is_platform_admin,'
  'is_viewer,my_access_request,platform_convert_demo,platform_create_demo_account,'
  'platform_create_department,platform_create_organization,platform_delete_movements,'
  'platform_ensure_demo_organization,platform_list_departments,platform_reset_demo_organization,'
  'platform_undo_asset_import,platform_update_department,platform_update_organization,'
  'role_has_permission,signup_link_info',
  'signed-in users call only the reviewed security definer functions');

select tests.eq((
  select string_agg(p.proname, ',' order by p.proname) from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosecdef
     and has_function_privilege('anon', p.oid, 'execute')),
  'signup_link_info', 'signed-out visitors call only signup_link_info');

rollback;
