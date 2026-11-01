-- A hospital admin changing another person's sign-in email no longer switches it at once (update-staff used to
-- mark the new address confirmed itself, so an admin could point an account at an address they control and then
-- send a password-reset link there). The change now waits for the NEW address to confirm: update-staff keeps the
-- request here (only the hash of its one-time token) and mails the link; staff-signup applies it when the link is
-- opened. The platform owner still changes an email at once.
create table if not exists public.email_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  new_email text not null,
  token_hash text not null unique,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now()
);
-- One waiting request per person: a new one replaces the old.
create unique index if not exists email_change_requests_user_idx on public.email_change_requests (user_id);
create index if not exists email_change_requests_org_idx on public.email_change_requests (organization_id);
create index if not exists email_change_requests_requested_by_idx on public.email_change_requests (requested_by);
alter table public.email_change_requests enable row level security;
-- No policy and no grant: the edge functions (service role) are the only readers and writers.
revoke all on public.email_change_requests from public, anon, authenticated;
grant all on public.email_change_requests to service_role;

-- The audit trail records the request too.
alter table public.account_events drop constraint if exists account_events_action_check;
alter table public.account_events add constraint account_events_action_check
  check (action in ('password_link', 'invite_link', 'email_changed', 'email_change_requested'));
