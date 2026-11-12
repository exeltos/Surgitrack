-- A leftover of debugging, never in the repository: it echoed the caller's request headers and could be
-- called signed out (anon), with a role-mutable search_path. Nothing uses it (no dependents, no function,
-- view, edge function or app code calls it).
drop function if exists public.tmp_debug_headers();
