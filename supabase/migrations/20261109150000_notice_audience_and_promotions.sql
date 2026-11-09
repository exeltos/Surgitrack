-- Notices and promotions from the platform owner: who sees one (every user, or only the hospital administrators) and
-- in which hospitals (all, or the ones named). A promotion is a notice for the administrators with a title and a link:
-- it shows as a card on the hospital's Overview, where a notice shows as a strip at the top of the app.
--
-- Reading is narrowed accordingly: the platform owner reads everything; anyone else reads a notice only when it is
-- for their hospital and, if it is for the administrators, only when they are one. Writing stays the owner's.
alter table public.platform_notices
  add column if not exists kind text not null default 'NOTICE',
  add column if not exists audience text not null default 'ALL',
  add column if not exists title text,
  add column if not exists link_url text,
  add column if not exists link_label text,
  add column if not exists organization_ids uuid[];

alter table public.platform_notices
  add constraint platform_notices_kind_check check (kind in ('NOTICE', 'PROMO')),
  add constraint platform_notices_audience_check check (audience in ('ALL', 'ADMINS')),
  add constraint platform_notices_title_check check (title is null or length(btrim(title)) between 1 and 120),
  -- A link opens another site from the app: https only, no spaces.
  add constraint platform_notices_link_check
    check (link_url is null or (link_url ~* '^https://[^[:space:]]+$' and length(link_url) <= 500)),
  add constraint platform_notices_link_label_check
    check (link_label is null or length(btrim(link_label)) between 1 and 40),
  -- A promotion is for the administrators and has a title.
  add constraint platform_notices_promo_check check (kind <> 'PROMO' or (audience = 'ADMINS' and title is not null)),
  add constraint platform_notices_orgs_check
    check (organization_ids is null or cardinality(organization_ids) between 1 and 500);

drop policy if exists platform_notices_read on public.platform_notices;
create policy platform_notices_read on public.platform_notices for select to authenticated using (
  (select public.is_platform_admin())
  or (
    (organization_ids is null or (select public.current_org_id()) = any (organization_ids))
    and (audience = 'ALL' or (select public.current_role()) = 'ADMIN')
  )
);
