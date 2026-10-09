-- Evaluation Demos, phase 6: lifecycle.
--  - The prospect's people are emailed 3 days before the end and once it has ended (demo-lifecycle,
--    run daily); these columns keep each email to once per end date.
--  - A Demo that ended more than 30 days ago is deleted with its users, unless the owner keeps it
--    (auto_delete off) or it became a customer.
--  - Conversion to a customer: the Demo hospital becomes a real one, with or without its sample data.
alter table public.demo_accounts
  add column if not exists ending_notice_for timestamptz,
  add column if not exists ended_notice_for timestamptz,
  add column if not exists auto_delete boolean not null default true,
  add column if not exists converted_at timestamptz;

alter table public.demo_accounts drop constraint if exists demo_accounts_status_check;
alter table public.demo_accounts
  add constraint demo_accounts_status_check check (status in ('PREPARING', 'SENT', 'CONVERTED'));

/**
 * The platform owner turns an evaluation Demo into a customer hospital: a real (not Demo) hospital
 * under a new name and code, in standard use or on a trial. Its users and departments stay;
 * the sample records go unless keep_data.
 */
create or replace function public.platform_convert_demo(
  p_demo uuid,
  p_name text,
  p_code text,
  p_plan text,
  p_trial_ends_at timestamptz,
  p_keep_data boolean
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if p_plan not in ('STANDARD', 'TRIAL') then raise exception 'invalid plan'; end if;
  if p_plan = 'TRIAL' and (p_trial_ends_at is null or p_trial_ends_at <= now()) then
    raise exception 'trial needs a future end date';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'name required'; end if;
  select d.organization_id into v_org
    from public.demo_accounts d
    join public.organizations o on o.id = d.organization_id
   where d.id = p_demo and d.status <> 'CONVERTED' and o.is_demo and o.evaluation;
  if v_org is null then raise exception 'not an evaluation demo'; end if;
  if not p_keep_data then
    perform public.platform_reset_demo_organization(v_org);
  end if;
  update public.organizations
     set name = trim(p_name),
         code = upper(trim(p_code)),
         is_demo = false,
         evaluation = false,
         active = true,
         plan = p_plan,
         trial_ends_at = case when p_plan = 'TRIAL' then p_trial_ends_at end,
         updated_at = now()
   where id = v_org;
  update public.demo_accounts
     set status = 'CONVERTED', converted_at = now(), auto_delete = false, updated_at = now()
   where id = p_demo;
end $$;
revoke all on function public.platform_convert_demo(uuid, text, text, text, timestamptz, boolean) from public, anon;
grant execute on function public.platform_convert_demo(uuid, text, text, text, timestamptz, boolean) to authenticated;
