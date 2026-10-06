create table if not exists public.registration_requests (
 id uuid primary key default gen_random_uuid(),
 full_name text not null,
 email text not null,
 organization_name text,
 department_name text,
 status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id),
 notes text
);
create unique index if not exists registration_requests_pending_email_unique on public.registration_requests(lower(email)) where status='PENDING';
alter table public.registration_requests enable row level security;
drop policy if exists registration_requests_platform_admin_read on public.registration_requests;
create policy registration_requests_platform_admin_read on public.registration_requests for select to authenticated using (public.is_platform_admin());
drop policy if exists registration_requests_platform_admin_update on public.registration_requests;
create policy registration_requests_platform_admin_update on public.registration_requests for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create or replace function public.submit_registration_request(p_full_name text,p_email text,p_organization_name text default null,p_department_name text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 if length(trim(p_full_name)) < 2 or position('@' in p_email)=0 then raise exception 'invalid registration request'; end if;
 insert into public.registration_requests(full_name,email,organization_name,department_name)
 values(trim(p_full_name),lower(trim(p_email)),nullif(trim(p_organization_name),''),nullif(trim(p_department_name),''))
 on conflict (lower(email)) where status='PENDING'
 do update set full_name=excluded.full_name,organization_name=excluded.organization_name,department_name=excluded.department_name,requested_at=now()
 returning id into rid;
 return rid;
end; $$;
revoke all on function public.submit_registration_request(text,text,text,text) from public;
grant execute on function public.submit_registration_request(text,text,text,text) to anon,authenticated;
