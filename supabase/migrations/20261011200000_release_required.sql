-- A Set or standalone instrument becomes ready only with a release of a passed cycle: the step after
-- 20261010152714_release_integrity, which only logged such changes for the nightly checks.
--
-- The app already saves each cycle and release before the Set or instrument it makes ready (#159,
-- SAVED_AFTER in useAppRecordSync), so the release is on the server when the new state arrives. Now the
-- database refuses (check_violation, 23514) a change from a sterilization stage straight to IN_STORAGE or
-- READY_FOR_PICKUP unless the item's latest release says RELEASED, with acceptable cycle parameters, intact
-- packaging, no failed biological indicator and a PASSED cycle on record, and that release has not made the
-- item ready before. The app's sync reports such a refusal and puts the server's version back.
--
-- Each release makes its item ready once: the change is logged in release_transitions with the release it
-- used, so an old release cannot make the item ready again on its next round. Set members follow their Set;
-- imports, restores and the service role (no signed-in user) are not checked, as before. The trigger runs
-- after the other update triggers (its name sorts last), so it sees the state the guards leave.

alter table public.release_transitions add column release_id text;
create index release_transitions_release on public.release_transitions (organization_id, asset_id, release_id);

-- The releases saved before this check made their items ready already: they are marked used,
-- with the time they were saved, so the nightly checks do not see them as late. A release saved in the last
-- day for an item still in a sterilization stage is left unused: its Set may still be on its way from a device.
insert into public.release_transitions (organization_id, asset_kind, asset_id, from_state, to_state, changed_at, release_id)
select r.organization_id, coalesce(r.asset_kind, 'SET'), r.asset_id, 'BEFORE_RELEASE_CHECK', 'BEFORE_RELEASE_CHECK',
       r.created_at, r.id
  from public.sterilization_releases r
 where r.asset_id is not null
   and r.decision = 'RELEASED'
   and coalesce(r.asset_kind, 'SET') in ('SET', 'TOOL')
   and (r.created_at < now() - interval '1 day'
        or not exists (
          select 1 from public.instrument_sets s
           where s.organization_id = r.organization_id and s.id = r.asset_id
             and s.state in ('PENDING_STERILIZATION', 'IN_WASHING', 'IN_PREPARATION', 'IN_PACKAGING',
                             'IN_STERILIZATION', 'AWAITING_RELEASE')
          union all
          select 1 from public.instruments i
           where i.organization_id = r.organization_id and i.id = r.asset_id
             and i.state in ('PENDING_STERILIZATION', 'IN_WASHING', 'IN_PREPARATION', 'IN_PACKAGING',
                             'IN_STERILIZATION', 'AWAITING_RELEASE')));

create or replace function public.require_release_for_ready() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  kind text := case when tg_table_name = 'instrument_sets' then 'SET' else 'TOOL' end;
  latest record;
begin
  if auth.uid() is null then
    return new;
  end if;
  select r.id, r.decision, r.physical_parameters_ok, r.packaging_integrity_ok, r.biological_indicator_result,
         c.result as cycle_result,
         exists (select 1 from public.release_transitions t
                  where t.organization_id = r.organization_id and t.asset_id = r.asset_id
                    and t.release_id = r.id) as used
    into latest
    from public.sterilization_releases r
    left join public.sterilization_cycles c
      on c.organization_id = r.organization_id and c.id = r.cycle_record_id and c.asset_id = r.asset_id
   where r.organization_id = new.organization_id and r.asset_id = new.id
     and coalesce(r.asset_kind, kind) = kind
   order by r.created_at desc, r.id desc
   limit 1;
  if latest.id is null
     or latest.used
     or latest.decision is distinct from 'RELEASED'
     or not coalesce(latest.physical_parameters_ok, false)
     or not coalesce(latest.packaging_integrity_ok, false)
     or latest.biological_indicator_result is not distinct from 'FAIL'
     or latest.cycle_result is distinct from 'PASSED' then
    raise exception 'A Set or instrument becomes ready only with a release of a passed cycle (%)', new.id
      using errcode = 'check_violation';
  end if;
  insert into public.release_transitions (organization_id, asset_kind, asset_id, from_state, to_state, changed_by, release_id)
  values (new.organization_id, kind, new.id, old.state, new.state, auth.uid(), latest.id);
  return new;
end $fn$;
revoke execute on function public.require_release_for_ready() from public, anon, authenticated;

drop trigger instrument_sets_release_transition on public.instrument_sets;
drop trigger instruments_release_transition on public.instruments;
drop function public.log_release_transition();

create trigger instrument_sets_zz_release_required before update of state on public.instrument_sets
  for each row
  when (new.state in ('IN_STORAGE', 'READY_FOR_PICKUP')
        and old.state in ('PENDING_STERILIZATION', 'IN_WASHING', 'IN_PREPARATION', 'IN_PACKAGING',
                          'IN_STERILIZATION', 'AWAITING_RELEASE'))
  execute function public.require_release_for_ready();
create trigger instruments_zz_release_required before update of state on public.instruments
  for each row
  when (new.mode is distinct from 'SET_MEMBER'
        and new.state in ('IN_STORAGE', 'READY_FOR_PICKUP')
        and old.state in ('PENDING_STERILIZATION', 'IN_WASHING', 'IN_PREPARATION', 'IN_PACKAGING',
                          'IN_STERILIZATION', 'AWAITING_RELEASE'))
  execute function public.require_release_for_ready();
