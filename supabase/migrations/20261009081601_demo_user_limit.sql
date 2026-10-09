-- Evaluation Demos, phase 3: the prospect may add up to max_extra_users colleagues (5 unless the
-- platform owner changes it). An invitation waiting for its person holds a place, so the limit is
-- known when inviting; the database refuses an account over it whatever path makes it.

-- Places left in an evaluation Demo (null for any other hospital): the limit, less the accounts
-- other than the prospect's, less the invitations nobody has signed up with yet.
create or replace function public.demo_seats_left(p_org uuid) returns int
language sql stable security definer set search_path = public as $$
  select d.max_extra_users
       - (select count(*) from public.profiles p
           where p.organization_id = p_org and p.id is distinct from d.evaluator_id)::int
       - (select count(*) from public.staff_access_requests r
           where r.organization_id = p_org and r.status = 'PENDING_EMAIL' and r.user_id is null)::int
    from public.demo_accounts d
   where d.organization_id = p_org
$$;
grant execute on function public.demo_seats_left(uuid) to authenticated, service_role;

-- No account beyond the limit (the prospect's own comes first, before evaluator_id is set).
create or replace function public.demo_user_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max int; v_evaluator uuid; v_count int;
begin
  select max_extra_users, evaluator_id into v_max, v_evaluator
    from public.demo_accounts where organization_id = new.organization_id;
  if v_max is null or v_evaluator is null then return new; end if;
  select count(*) into v_count from public.profiles
   where organization_id = new.organization_id and id <> v_evaluator;
  if v_count >= v_max then
    raise exception 'demo_user_limit' using errcode = 'P0001', hint = 'The Demo has reached its user limit.';
  end if;
  return new;
end $$;
create trigger profiles_demo_user_limit before insert on public.profiles
  for each row execute function public.demo_user_limit();
