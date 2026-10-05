alter table public.registration_requests add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.registration_requests add column if not exists email_confirmed_at timestamptz;
alter table public.registration_requests drop constraint if exists registration_requests_status_check;
alter table public.registration_requests add constraint registration_requests_status_check check (status in ('PENDING_EMAIL','PENDING','APPROVED','REJECTED'));
update public.registration_requests set status='PENDING' where status not in ('PENDING_EMAIL','PENDING','APPROVED','REJECTED');

create or replace function public.submit_registration_request(p_full_name text,p_email text,p_organization_name text default null,p_department_name text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 if length(trim(p_full_name)) < 2 or position('@' in p_email)=0 then raise exception 'invalid registration request'; end if;
 insert into public.registration_requests(full_name,email,organization_name,department_name,status)
 values(trim(p_full_name),lower(trim(p_email)),nullif(trim(p_organization_name),''),nullif(trim(p_department_name),''),'PENDING_EMAIL')
 on conflict (lower(email)) where status in ('PENDING','PENDING_EMAIL')
 do update set full_name=excluded.full_name,organization_name=excluded.organization_name,department_name=excluded.department_name,requested_at=now(),status='PENDING_EMAIL'
 returning id into rid;
 return rid;
end; $$;

create or replace function public.link_registration_auth_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.registration_requests
 set user_id=new.id,
     email_confirmed_at=case when new.email_confirmed_at is not null then new.email_confirmed_at else email_confirmed_at end,
     status=case when new.email_confirmed_at is not null then 'PENDING' else status end
 where lower(email)=lower(new.email) and status in ('PENDING_EMAIL','PENDING');
 return new;
end $$;
drop trigger if exists surgitrack_registration_auth_link on auth.users;
create trigger surgitrack_registration_auth_link after insert or update of email_confirmed_at on auth.users for each row execute function public.link_registration_auth_user();

create or replace function public.list_registration_requests()
returns table(id uuid,full_name text,email text,organization_name text,department_name text,status text,requested_at timestamptz,email_confirmed_at timestamptz)
language sql security definer set search_path=public as $$
 select r.id,r.full_name,r.email,r.organization_name,r.department_name,r.status,r.requested_at,r.email_confirmed_at
 from public.registration_requests r
 where public.is_platform_admin()
 order by r.requested_at desc;
$$;
revoke all on function public.list_registration_requests() from public;
grant execute on function public.list_registration_requests() to authenticated;
