-- «Ζητήστε παρουσίαση» on the public first page: what a visitor sends (name, hospital, role, email, phone,
-- message). The contact-request edge function (service role) stores it and emails the company; only the
-- platform owner reads them (Studio → Αιτήματα παρουσίασης) and marks them handled or deletes them. Visitors
-- and hospital users have no access at all. The sender's address is kept only as a salted hash, to limit
-- how many requests one address may send.

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  organization text check (char_length(organization) <= 160),
  role text check (char_length(role) <= 120),
  email text not null check (char_length(email) between 5 and 200),
  phone text check (char_length(phone) <= 40),
  message text not null check (char_length(btrim(message)) between 5 and 3000),
  ip_hash text,
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);
create index if not exists contact_requests_created_idx on public.contact_requests (created_at desc);
create index if not exists contact_requests_ip_idx on public.contact_requests (ip_hash, created_at desc);
create index if not exists contact_requests_handled_by_idx on public.contact_requests (handled_by);

alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from public, anon, authenticated;
grant select, delete on public.contact_requests to authenticated;
grant update (handled_at, handled_by) on public.contact_requests to authenticated;
grant all on public.contact_requests to service_role;

create policy contact_requests_read on public.contact_requests for select to authenticated
  using ((select public.is_platform_admin()));
create policy contact_requests_update on public.contact_requests for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy contact_requests_delete on public.contact_requests for delete to authenticated
  using ((select public.is_platform_admin()));
