-- The company's contact on the public first page of www.surgitrack.eu (before sign-in): name, email, phone and
-- website, set by the platform owner in Studio → Settings. Visitors who are not signed in read only these four,
-- through public_contact(); the rest of platform_settings stays closed to them.

alter table public.platform_settings
  add column if not exists public_name text,
  add column if not exists public_email text,
  add column if not exists public_phone text,
  add column if not exists public_website text;

update public.platform_settings
   set public_name = coalesce(public_name, 'Exeltos'),
       public_email = coalesce(public_email, 'info@exeltos.com'),
       public_phone = coalesce(public_phone, '694 247 1022'),
       public_website = coalesce(public_website, 'https://exeltos.com/')
 where id;

create or replace function public.public_contact()
returns table (name text, email text, phone text, website text)
language sql stable security definer set search_path = public as $$
  select public_name, public_email, public_phone, public_website from public.platform_settings where id
$$;
revoke all on function public.public_contact() from public;
grant execute on function public.public_contact() to anon, authenticated;
