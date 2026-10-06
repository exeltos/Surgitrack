-- User-code sign-in now runs in the login-with-code edge function; the email lookup must not be public.
revoke execute on function public.resolve_login_email(text) from public, anon, authenticated;
