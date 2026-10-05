-- Final step of leaving app_records. Run once, after the app version that reads and writes only the
-- new tables is live (it holds deletes, so the owner runs it from the SQL editor).

-- 1. Last copy of anything an older browser may still have written, then stop forwarding.
select public.copy_legacy_records();
select public.copy_legacy_settings();
drop trigger if exists app_records_forward on public.app_records;
drop function if exists public.forward_legacy_records();
drop function if exists public.copy_legacy_records();
drop function if exists public.copy_legacy_settings();

-- 2. The Demo reset clears every table of the hospital; department renames follow into them.
create or replace function public.platform_reset_demo_organization(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.organizations where id = p_org and is_demo) then
    raise exception 'not a demo organization';
  end if;
  delete from public.instruments where organization_id = p_org;
  delete from public.instrument_sets where organization_id = p_org;
  delete from public.movements where organization_id = p_org;
  delete from public.issues where organization_id = p_org;
  delete from public.receipts where organization_id = p_org;
  delete from public.deliveries where organization_id = p_org;
  delete from public.preparations where organization_id = p_org;
  delete from public.surgical_counts where organization_id = p_org;
  delete from public.workflow_checkpoints where organization_id = p_org;
  delete from public.sterilization_cycles where organization_id = p_org;
  delete from public.sterilization_releases where organization_id = p_org;
  delete from public.process_loads where organization_id = p_org;
  delete from public.recall_cases where organization_id = p_org;
  delete from public.hospital_settings where organization_id = p_org;
end $$;

create or replace function public.rename_department_references() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.instrument_sets set department = new.name
     where organization_id = new.organization_id and department = old.name;
    update public.instruments set department = new.name
     where organization_id = new.organization_id and department = old.name;
    update public.issues set department = new.name
     where organization_id = new.organization_id and department = old.name;
  end if;
  return new;
end $$;

-- 3. One stamping function for every table whose records change.
drop trigger if exists instrument_sets_touch on public.instrument_sets;
drop trigger if exists instruments_touch on public.instruments;
drop trigger if exists issues_touch on public.issues;
create trigger instrument_sets_touch before update on public.instrument_sets for each row execute function public.touch_updated_row();
create trigger instruments_touch before update on public.instruments for each row execute function public.touch_updated_row();
create trigger issues_touch before update on public.issues for each row execute function public.touch_updated_row();
drop function if exists public.touch_instrument_row();
drop function if exists public.touch_issue_row();

-- 4. app_records goes.
drop table public.app_records;

-- 5. Leftovers nothing uses any more (neither the app nor the server functions).
-- The first signup flow, replaced by access requests (staff_access_requests):
drop trigger if exists surgitrack_registration_auth_link on auth.users;
drop function if exists public.link_registration_auth_user();
drop function if exists public.list_registration_requests();
drop function if exists public.submit_registration_request(text, text, text, text);
drop table if exists public.registration_requests;
-- Studio sets access through update-staff now; these had no callers either:
drop function if exists public.platform_set_profile_access(uuid, boolean, boolean);
drop function if exists public.resolve_login_email(text);
drop function if exists public.current_department_id();
-- Types of the first relational draft (its tables are gone):
drop type if exists public.asset_state;
drop type if exists public.tool_mode;

-- 6. What is left, for a quick look: every table with its rows.
select relname as table_name, n_live_tup as rows
from pg_stat_user_tables where schemaname = 'public' order by relname;
