-- One way in for hospital staff: an invitation (by email, or its link passed on by hand) or the
-- hospital's signup link opens one form, where the person also sets their password. Their account
-- and username are made at once but stay inactive until the hospital admin approves; approval
-- activates it. The request keeps the username (shown on the form and the waiting screen) and
-- whether the person was invited as a Sterilization supervisor.
alter table public.staff_access_requests add column if not exists supervisor boolean not null default false;
alter table public.staff_access_requests add column if not exists user_code text;

-- The signed-in applicant's request, for the waiting screen (now with their username).
create or replace function public.my_access_request()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'full_name', r.full_name,
    'email', r.email,
    'user_code', r.user_code,
    'organization_name', o.name,
    'department_name', d.name,
    'decision_note', r.decision_note,
    'admin_notified', r.admin_notified_at is not null)
  from public.staff_access_requests r
  join public.organizations o on o.id = r.organization_id
  left join public.departments d on d.id = r.department_id
  where r.user_id = auth.uid()
  order by r.requested_at desc
  limit 1
$$;
