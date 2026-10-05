alter table public.profiles add column if not exists user_code text;
create unique index if not exists profiles_user_code_unique on public.profiles (upper(user_code)) where user_code is not null;
alter table public.profiles add constraint profiles_user_code_format check (user_code is null or user_code ~ '^[A-Z]{2}[0-9]{4}$');

create or replace function public.generate_user_code(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text;
  parts text[];
  initials text := '';
  candidate text;
  n integer;
begin
  clean := upper(translate(coalesce(p_name,''),'ΑΆΒΓΔΕΈΖΗΉΘΙΊΪΚΛΜΝΞΟΌΠΡΣΤΥΎΫΦΧΨΩΏ','AABGDEEZIITIIKLMNXOOPRSTYYYFXPSOO'));
  parts := regexp_split_to_array(trim(clean), '\\s+');
  if array_length(parts,1) >= 2 then
    initials := left(parts[1],1) || left(parts[array_length(parts,1)],1);
  else
    initials := left(regexp_replace(clean,'[^A-Z]','','g') || 'XX',2);
  end if;
  initials := regexp_replace(initials,'[^A-Z]','','g');
  initials := left(initials || 'XX',2);
  loop
    n := floor(random()*10000)::int;
    candidate := initials || lpad(n::text,4,'0');
    exit when not exists (select 1 from public.profiles where upper(user_code)=candidate);
  end loop;
  return candidate;
end;
$$;

update public.profiles set user_code = public.generate_user_code(name) where user_code is null;

create or replace function public.assign_user_code()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.user_code is null then new.user_code := public.generate_user_code(new.name); end if;
  new.user_code := upper(new.user_code);
  return new;
end; $$;

drop trigger if exists profiles_assign_user_code on public.profiles;
create trigger profiles_assign_user_code before insert or update of name,user_code on public.profiles for each row execute function public.assign_user_code();
