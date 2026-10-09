-- Signed-out visitors (anon) get nothing in public by default any more.
--
-- 20261006140426 revoked anon's table grants, but the platform's default privileges for objects that
-- `postgres` creates in public still handed anon every privilege on each new table and sequence, and
-- EXECUTE on each new function (as did the built-in default to PUBLIC). So the tables made since came
-- back with anon grants (deleted_records; demo_feedback, demo_guide_progress, demo_requests and
-- demo_seed_runs with full DML and TRUNCATE, which row level security does not cover), and
-- demo_seats_left / demo_user_limit (security definer) became callable by anyone.
--
-- 1. Default privileges of `postgres` (the role migrations run as): no anon on new tables, sequences
--    and functions in public, and no PUBLIC execute on new functions. PUBLIC's EXECUTE comes from the
--    built-in global default, so it is revoked globally (FOR ROLE postgres, no IN SCHEMA): a function
--    `postgres` creates anywhere is callable only by the roles it is granted to. `authenticated` and
--    `service_role` keep their schema-level defaults in public.
--    The same defaults for `supabase_admin` cannot be changed here: only a member of supabase_admin
--    may alter them, and `postgres` is not one on the platform. Nothing in this project is created
--    by supabase_admin in public; a migration that ever needed it must revoke explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

-- 2. The grants that came back. Every table and sequence in public: the app never reads or writes a
--    table signed out (sign-in, signup and the signup page use RPCs and edge functions).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 3. Functions: none callable signed out except signup_link_info (the public staff signup page shows
--    the hospital of a signup link before the person has an account). Trigger functions need no
--    EXECUTE grant to fire, so demo_user_limit and touch_updated_row lose theirs entirely.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.signup_link_info(text) to anon, authenticated;
revoke execute on function public.demo_user_limit() from authenticated;
revoke execute on function public.touch_updated_row() from authenticated;
-- The People page of an evaluation Demo shows the seats left; invite-staff (service role) checks them.
grant execute on function public.demo_seats_left(uuid) to authenticated, service_role;

-- 4. Two policies were written without a role, so they applied to {public} (anon included).
alter policy deleted_records_read on public.deleted_records to authenticated;
alter policy org_update on public.organizations to authenticated;

-- 5. One permissive policy per table and action on the Demo tables (the advisor's
--    multiple_permissive_policies), each the OR of the two it replaces, so who may do what is unchanged.

-- demo_accounts: the owner manages them; the people of a Demo read their own row.
drop policy if exists demo_accounts_owner on public.demo_accounts;
drop policy if exists demo_accounts_own_read on public.demo_accounts;
drop policy if exists demo_accounts_read on public.demo_accounts;
drop policy if exists demo_accounts_insert on public.demo_accounts;
drop policy if exists demo_accounts_update on public.demo_accounts;
drop policy if exists demo_accounts_delete on public.demo_accounts;
create policy demo_accounts_read on public.demo_accounts for select to authenticated
  using (organization_id = (select public.current_org_id()) or (select public.is_platform_admin()));
create policy demo_accounts_insert on public.demo_accounts for insert to authenticated
  with check ((select public.is_platform_admin()));
create policy demo_accounts_update on public.demo_accounts for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy demo_accounts_delete on public.demo_accounts for delete to authenticated
  using ((select public.is_platform_admin()));

-- demo_guide_progress and demo_feedback: each person their own rows, only in their own evaluation
-- Demo; the owner reads everyone's.
do $$
declare
  t text;
begin
  foreach t in array array['demo_guide_progress', 'demo_feedback'] loop
    execute format('drop policy if exists %1$s_own on public.%1$s', t);
    execute format('drop policy if exists %1$s_owner on public.%1$s', t);
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format($p$create policy %1$s_read on public.%1$s for select to authenticated
      using ((user_id = (select auth.uid()) and organization_id = (select public.current_org_id()))
        or (select public.is_platform_admin()))$p$, t);
    execute format($p$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check (user_id = (select auth.uid()) and organization_id = (select public.current_org_id())
        and exists (select 1 from public.organizations o where o.id = organization_id and o.evaluation))$p$, t);
    execute format($p$create policy %1$s_update on public.%1$s for update to authenticated
      using (user_id = (select auth.uid()) and organization_id = (select public.current_org_id()))
      with check (user_id = (select auth.uid()) and organization_id = (select public.current_org_id())
        and exists (select 1 from public.organizations o where o.id = organization_id and o.evaluation))$p$, t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete to authenticated
      using (user_id = (select auth.uid()) and organization_id = (select public.current_org_id()))$p$, t);
  end loop;
end $$;

-- demo_requests: the people of an evaluation Demo send and see their own; the owner sees and handles all.
drop policy if exists demo_requests_own_insert on public.demo_requests;
drop policy if exists demo_requests_own_read on public.demo_requests;
drop policy if exists demo_requests_owner on public.demo_requests;
drop policy if exists demo_requests_read on public.demo_requests;
drop policy if exists demo_requests_insert on public.demo_requests;
drop policy if exists demo_requests_update on public.demo_requests;
drop policy if exists demo_requests_delete on public.demo_requests;
create policy demo_requests_read on public.demo_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));
create policy demo_requests_insert on public.demo_requests for insert to authenticated
  with check (
    (user_id = (select auth.uid())
      and organization_id = (select public.current_org_id())
      and exists (select 1 from public.organizations o where o.id = organization_id and o.evaluation))
    or (select public.is_platform_admin())
  );
create policy demo_requests_update on public.demo_requests for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy demo_requests_delete on public.demo_requests for delete to authenticated
  using ((select public.is_platform_admin()));
