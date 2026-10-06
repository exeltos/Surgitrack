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
    'organization_name', o.name,
    'department_name', d.name,
    'decision_note', r.decision_note,
    'admin_notified', r.admin_notified_at is not null)
  from public.staff_access_requests r
  join public.organizations o on o.id = r.organization_id
  left join public.departments d on d.id = r.department_id
  where r.user_id = auth.uid()
$$;
revoke execute on function public.my_access_request() from anon;
