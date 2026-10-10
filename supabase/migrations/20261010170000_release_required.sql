-- The strict form of the load release (20261010152714_release_integrity only logged it).
--
-- A Set or standalone instrument that a signed-in user makes ready (IN_STORAGE or READY_FOR_PICKUP) straight
-- from a sterilization stage needs a saved release of it that says RELEASED, of a cycle of it that PASSED, and
-- that no earlier such change used: each release makes its asset ready once. Otherwise the change is refused
-- with a check violation, which the app's sync reports as refused, putting the server's version back.
-- The app saves cycles and releases before Sets and instruments (useAppRecordSync, SAVED_AFTER), so its own
-- changes find their release. Apply this only once that version of the app is published and pages opened
-- before it have reloaded: an older page saves the Set first and would have the change refused.
-- Set members follow their Set; imports, restores and the service role (no signed-in user) are not checked.
-- The release used is kept in release_transitions.release_id.

alter table public.release_transitions add column release_id text;
create unique index release_transitions_release on public.release_transitions (organization_id, release_id)
  where release_id is not null;

-- The logging trigger function becomes the check (renamed, so its two triggers keep calling it).
create or replace function public.log_release_transition() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  used text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select r.id into used
    from public.sterilization_releases r
    join public.sterilization_cycles c
      on c.organization_id = r.organization_id and c.id = r.cycle_record_id and c.asset_id = r.asset_id
   where r.organization_id = new.organization_id and r.asset_id = new.id
     and r.decision = 'RELEASED' and c.result = 'PASSED'
     and not exists (select 1 from public.release_transitions t
                      where t.organization_id = r.organization_id and t.release_id = r.id)
   order by r.created_at desc
   limit 1;
  if used is null then
    raise exception '% cannot become % without a release of a passed cycle', coalesce(new.barcode, new.id), new.state
      using errcode = 'check_violation';
  end if;
  insert into public.release_transitions (organization_id, asset_kind, asset_id, from_state, to_state, changed_by, release_id)
  values (new.organization_id, case when tg_table_name = 'instrument_sets' then 'SET' else 'TOOL' end,
          new.id, old.state, new.state, auth.uid(), used);
  return null;
end $fn$;
alter function public.log_release_transition() rename to require_release;
alter trigger instrument_sets_release_transition on public.instrument_sets rename to instrument_sets_release_required;
alter trigger instruments_release_transition on public.instruments rename to instruments_release_required;
