-- Read only: the Sets of ΧΕΙΡΟΥΡΓΕΙΟ at ΙΑΣΩ, each with its instruments in use.
with o as (select id from organizations where name ilike '%ΙΑΣΩ%')
select coalesce(json_agg(x order by x->'set'->>'specialty', x->'set'->>'barcode'), '[]'::json)
from (
  select json_build_object(
    'set', json_build_object('barcode', s.barcode, 'name', s.name,
      'specialty', coalesce(nullif(s.specialty, ''), 'Χωρίς ειδικότητα'), 'department', s.department),
    'tools', coalesce((
      select json_agg(json_build_array(i.barcode, i.name, i.code, i.manufacturer, i.serial_number, i.max_uses,
        i.wear_check, i.notes) order by i.barcode)
      from instruments i
      where i.organization_id = s.organization_id and i.set_id = s.id and i.state <> 'RETIRED'), '[]'::json)
  ) as x
  from instrument_sets s
  where s.organization_id in (select id from o) and s.department = 'ΧΕΙΡΟΥΡΓΕΙΟ'
) q;
