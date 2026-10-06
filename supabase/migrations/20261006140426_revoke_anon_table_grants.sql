-- Signed-out visitors never read or write these tables: the sign-in flow uses RPCs and edge functions
-- (security definer / service role), and every table query in the app runs after sign-in. They still carried
-- the platform default of every privilege for `anon`, including TRUNCATE, which row level security does not
-- cover. Row level security stays on; `authenticated` keeps its grants.
revoke all on public.departments, public.organizations, public.profiles, public.signup_links,
  public.staff_access_requests, public.user_invitations from anon;
