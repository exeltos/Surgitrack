-- The Greek→Latin map was one letter short after Ι, so Κ became L, Μ became N, etc.
-- Now: upper-case first (accents and final sigma included), then a one-to-one map.
create or replace function public.generate_user_code(p_name text)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare
  clean text;
  parts text[];
  initials text := '';
  candidate text;
  n integer;
begin
  clean := translate(
    upper(coalesce(p_name, '')),
    'ΑΆΒΓΔΕΈΖΗΉΘΙΊΪΚΛΜΝΞΟΌΠΡΣΤΥΎΫΦΧΨΩΏ',
    'AABGDEEZIITIIIKLMNXOOPRSTYYYFXPOO'
  );
  parts := regexp_split_to_array(trim(clean), '\s+');
  if array_length(parts, 1) >= 2 then
    initials := left(parts[1], 1) || left(parts[array_length(parts, 1)], 1);
  else
    initials := left(regexp_replace(clean, '[^A-Z]', '', 'g') || 'XX', 2);
  end if;
  initials := regexp_replace(initials, '[^A-Z]', '', 'g');
  initials := left(initials || 'XX', 2);
  loop
    n := floor(random() * 10000)::int;
    candidate := initials || lpad(n::text, 4, '0');
    exit when not exists (select 1 from public.profiles where upper(user_code) = candidate);
  end loop;
  return candidate;
end;
$function$;
