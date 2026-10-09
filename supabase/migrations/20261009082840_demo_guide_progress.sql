-- Evaluation Demos, phase 4: the first-steps guide. Each person in a prospect's Demo has a few
-- steps for their role; a step is done when they really do it (the app sees their own records,
-- or their visit to a screen) and is kept here, so the guide and the platform owner see progress.
create table if not exists public.demo_guide_progress (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_key text not null check (step_key ~ '^[a-z_]{2,40}$'),
  done_at timestamptz not null default now(),
  primary key (organization_id, user_id, step_key)
);
create index if not exists demo_guide_progress_user_idx on public.demo_guide_progress(user_id);
alter table public.demo_guide_progress enable row level security;
-- Each person records and reads their own steps, only in their own (evaluation Demo) hospital.
create policy demo_guide_progress_own on public.demo_guide_progress for all to authenticated
  using (user_id = (select auth.uid()) and organization_id = (select public.current_org_id()))
  with check (
    user_id = (select auth.uid())
    and organization_id = (select public.current_org_id())
    and exists (select 1 from public.organizations o where o.id = organization_id and o.evaluation)
  );
-- The platform owner sees everyone's.
create policy demo_guide_progress_owner on public.demo_guide_progress for select to authenticated
  using ((select public.is_platform_admin()));
grant select, insert on public.demo_guide_progress to authenticated;
