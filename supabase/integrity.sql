-- Data integrity checks, run every night by .github/workflows/backup.yml against the live database (and in
-- supabase/tests/sql/07_integrity.sql). One row per problem found: hospital, check, how many. No rows: all good.
-- The database has no foreign key from instruments to Sets on purpose: devices sync offline and send each
-- collection on its own, so a new Set's instruments may arrive before the Set. These checks catch what such
-- keys would have refused, after the fact and without losing a write.
-- States, modes and unique barcodes are already enforced by the tables' own constraints.
with problems(organization_id, check_name, n) as (
  select i.organization_id, 'instrument in a Set that does not exist', count(*)
    from public.instruments i
   where i.set_id is not null
     and not exists (select 1 from public.instrument_sets s where s.organization_id = i.organization_id and s.id = i.set_id)
   group by 1
  union all
  select organization_id, 'Set member without a Set', count(*)
    from public.instruments where mode = 'SET_MEMBER' and set_id is null group by 1
  union all
  select organization_id, 'Set on an instrument that is not a Set member', count(*)
    from public.instruments where mode <> 'SET_MEMBER' and set_id is not null group by 1
  union all
  select s.organization_id, 'Set count differs from its instruments', count(*)
    from public.instrument_sets s
   where s.actual <> (select count(*) from public.instruments i
                       where i.organization_id = s.organization_id and i.set_id = s.id and i.state <> 'RETIRED')
   group by 1
)
select coalesce(o.name, p.organization_id::text) as hospital, p.check_name, sum(p.n)::int as n
  from problems p left join public.organizations o on o.id = p.organization_id
 group by 1, 2
 order by 1, 2;
