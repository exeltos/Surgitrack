-- Failed user-code sign-ins, written only by the login-with-code edge function (service role).
create table if not exists public.login_attempts (
 id bigint generated always as identity primary key,
 user_code text not null,
 ip text not null,
 succeeded boolean not null,
 attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_code_time_idx on public.login_attempts(user_code, attempted_at desc);
create index if not exists login_attempts_ip_time_idx on public.login_attempts(ip, attempted_at desc);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
