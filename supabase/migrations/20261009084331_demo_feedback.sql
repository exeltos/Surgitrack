-- Evaluation Demos, phase 5: what the prospect thinks, and what they ask for.
--  demo_feedback: one row per person and topic: a 1–5 rating of a part of the app (module key),
--    or the final evaluation ('final': ease, fit, NPS 0–10, what is missing, hospital size).
--  demo_requests: "I want the application" (PURCHASE) or "I need more time" (EXTENSION), which the
--    platform owner handles from Studio (and is emailed about).
create table if not exists public.demo_feedback (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (topic ~ '^[a-z_]{2,40}$'),
  rating int check (rating between 1 and 5),
  nps int check (nps between 0 and 10),
  answers jsonb not null default '{}'::jsonb,
  comment text check (length(comment) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, topic)
);
create index if not exists demo_feedback_user_idx on public.demo_feedback(user_id);
alter table public.demo_feedback enable row level security;
create policy demo_feedback_own on public.demo_feedback for all to authenticated
  using (user_id = (select auth.uid()) and organization_id = (select public.current_org_id()))
  with check (
    user_id = (select auth.uid())
    and organization_id = (select public.current_org_id())
    and exists (select 1 from public.organizations o where o.id = organization_id and o.evaluation)
  );
create policy demo_feedback_owner on public.demo_feedback for select to authenticated
  using ((select public.is_platform_admin()));
grant select, insert, update on public.demo_feedback to authenticated;

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  kind text not null check (kind in ('PURCHASE', 'EXTENSION')),
  contact_name text check (length(contact_name) <= 120),
  phone text check (length(phone) <= 40),
  message text check (length(message) <= 2000),
  status text not null default 'NEW' check (status in ('NEW', 'HANDLED')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);
create index if not exists demo_requests_org_idx on public.demo_requests(organization_id, created_at desc);
create index if not exists demo_requests_user_idx on public.demo_requests(user_id);
create index if not exists demo_requests_handled_by_idx on public.demo_requests(handled_by);
alter table public.demo_requests enable row level security;
-- The people of an evaluation Demo send their own (also once it has ended: the trial lock does not
-- cover this table) and see their own; the owner sees and handles all.
create policy demo_requests_own_insert on public.demo_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and organization_id = (select public.current_org_id())
    and exists (select 1 from public.organizations o where o.id = organization_id and o.evaluation)
  );
create policy demo_requests_own_read on public.demo_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy demo_requests_owner on public.demo_requests for all to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
grant select, insert, update on public.demo_requests to authenticated;
