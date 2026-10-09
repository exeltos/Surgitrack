-- Evaluation Demos, second part (see 20261009070553_demo_accounts). Applied from the SQL editor:
-- the migration tool times out on statements it treats as destructive (drop, revoke).

-- There is still one built-in Demo; evaluation Demos are as many as the owner opens.
drop index if exists public.organizations_one_builtin_demo;
create unique index organizations_one_builtin_demo on public.organizations(is_demo)
  where is_demo and demo_of is null and not evaluation;

-- Signed-in users only, as for every other table and function.
revoke all on public.demo_accounts from anon;
revoke execute on function public.platform_ensure_demo_organization(uuid) from public, anon;
revoke execute on function public.platform_create_demo_account(text, text, text, text, timestamptz, text) from public, anon;
