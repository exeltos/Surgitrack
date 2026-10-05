-- Signup by approval: an applicant (through the hospital's signup link, or a personal email
-- invitation) only fills in their details; no account exists until the hospital admin approves.
-- On approval the account is created and the applicant gets their username and a link to set
-- their password. A request without an account yet has no user_id.
--  - invite_token: the personal invitation's link (status PENDING_EMAIL until the form is sent)
--  - invited_role: the role the admin picked when inviting, offered again at approval
alter table public.staff_access_requests alter column user_id drop not null;
alter table public.staff_access_requests add column if not exists invite_token text unique;
alter table public.staff_access_requests add column if not exists invited_role public.surgi_role;
alter table public.staff_access_requests add column if not exists invited_by uuid references auth.users(id) on delete set null;
alter table public.staff_access_requests add column if not exists invited_at timestamptz;
create index if not exists staff_access_requests_invited_by_idx on public.staff_access_requests(invited_by);
-- One open request per person and hospital.
create unique index if not exists staff_access_requests_open_email
  on public.staff_access_requests(organization_id, lower(email))
  where status in ('PENDING_EMAIL', 'PENDING');
