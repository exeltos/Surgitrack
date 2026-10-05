create table if not exists public.user_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 department_id uuid references public.departments(id) on delete set null,
 auth_user_id uuid references auth.users(id) on delete set null,
 full_name text not null,
 email text not null,
 role public.surgi_role not null,
 status text not null default 'SENT' check (status in ('SENT','ACCEPTED','REVOKED','FAILED')),
 invited_by uuid references public.profiles(id),
 invited_at timestamptz not null default now(),
 accepted_at timestamptz,
 last_sent_at timestamptz not null default now()
);
create unique index if not exists user_invitations_open_email_org on public.user_invitations(organization_id,lower(email)) where status='SENT';
create index if not exists user_invitations_org_idx on public.user_invitations(organization_id,status);
alter table public.user_invitations enable row level security;
drop policy if exists user_invitations_admin_select on public.user_invitations;
create policy user_invitations_admin_select on public.user_invitations for select to authenticated
using (public.is_platform_admin() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role='ADMIN' and p.organization_id=user_invitations.organization_id));

create or replace function public.accept_surgitrack_invitation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.email_confirmed_at is not null and old.email_confirmed_at is null then
   update public.profiles set active=true,updated_at=now() where id=new.id and active=false
     and exists(select 1 from public.user_invitations i where i.auth_user_id=new.id and i.status='SENT');
   update public.user_invitations set status='ACCEPTED',accepted_at=now()
     where auth_user_id=new.id and status='SENT';
 end if;
 return new;
end $$;
drop trigger if exists surgitrack_accept_invitation on auth.users;
create trigger surgitrack_accept_invitation after update of email_confirmed_at on auth.users
for each row execute function public.accept_surgitrack_invitation();
