-- The username «DEMO» for the one account that is given it (the owner's Demo hospital). Everyone else keeps the usual
-- shape: two letters and four digits. «DEMO» is held by one profile at most (profiles_user_code_unique), no staff
-- function sets a username (it is always generated, in that shape), and who may change one is limited already
-- (profiles_identity_guard): the owner gives it by hand, to the account, in the database.
alter table public.profiles drop constraint if exists profiles_user_code_format;
alter table public.profiles add constraint profiles_user_code_format
  check (user_code is null or user_code ~ '^[A-Z]{2}[0-9]{4}$' or user_code = 'DEMO');
