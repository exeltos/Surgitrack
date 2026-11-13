-- A department person signs a handover by showing a QR on their own signed-in phone, instead of typing their
-- username and password on the Sterilization device. The QR holds a one-time pass: handover-pass makes it for
-- the signed-in person (it lives 45 seconds, the phone shows a new one every 30), verify-handover takes it in
-- place of a username and password, once. Only the pass's SHA-256 is stored, never the pass itself.

create table if not exists public.handover_passes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists handover_passes_user_idx on public.handover_passes (user_id, created_at desc);
alter table public.handover_passes enable row level security;
-- Nobody signed in reads or writes them: only the two edge functions (service role).
revoke all on public.handover_passes from public, anon, authenticated;
grant all on public.handover_passes to service_role;

-- Takes a pass once: the person it was made for, if it is unused, not expired and of this hospital; null
-- otherwise. One statement, so two devices scanning the same QR cannot both use it.
create or replace function public.consume_handover_pass(p_token_hash text, p_organization_id uuid)
returns uuid language sql security definer set search_path = public as $$
  update public.handover_passes
     set used_at = now()
   where token_hash = p_token_hash
     and organization_id = p_organization_id
     and used_at is null
     and expires_at > now()
  returning user_id;
$$;
revoke execute on function public.consume_handover_pass(text, uuid) from public, anon, authenticated;
grant execute on function public.consume_handover_pass(text, uuid) to service_role;
