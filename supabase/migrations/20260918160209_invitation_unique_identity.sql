drop index if exists public.user_invitations_open_email_org;
create unique index if not exists user_invitations_email_org_unique on public.user_invitations(organization_id,lower(email));
