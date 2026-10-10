-- Signing up through a hospital's shared link needs the email confirmed before the request reaches the
-- hospital admin: anyone with the link could otherwise sign up with a colleague's address. staff-signup
-- stores a one-time confirm_token on the request (status PENDING_EMAIL, with the account already made,
-- inactive and unconfirmed) and emails a link carrying it; opening the link confirms the sign-in email and
-- moves the request to PENDING. Personal invitations are unchanged (the admin chose that address).
alter table public.staff_access_requests add column if not exists confirm_token text;
create unique index if not exists staff_access_requests_confirm_token_idx
  on public.staff_access_requests (confirm_token) where confirm_token is not null;
