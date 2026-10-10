-- The load release, checked by the database too (the screens already apply it):
--
-- 1. A release record that says RELEASED has acceptable cycle parameters, intact packaging and no failed
--    biological indicator. The app never writes anything else (useLoadActions and useReceiptAndCycleActions
--    turn such a decision into REPROCESS); a direct write through the API that tries is refused with a check
--    violation, which the app's sync reports as refused and does not send again. Added NOT VALID and then
--    validated (checked live first: no saved row breaks it), so the scan does not hold up writes. The
--    chemical indicator is not part of it: a hospital may release on the biological one alone, and the
--    record keeps only whether the chemical one passed.
--
-- 2. A Set or standalone instrument that goes from a sterilization stage straight to a ready state
--    (IN_STORAGE or READY_FOR_PICKUP) through the API is logged in release_transitions. Not refused: a device
--    sends each collection on its own, so the release may arrive just after the new state. The nightly
--    supabase/integrity.sql names those with no release of a passed cycle within 12 hours of the change.
--    Set members follow their Set; imports, restores and the service role (no signed-in user) are not logged.

-- 1 -----------------------------------------------------------------------------------------------
alter table public.sterilization_releases add constraint sterilization_releases_released_checks check (
  decision is distinct from 'RELEASED'
  or (coalesce(physical_parameters_ok, false) and coalesce(packaging_integrity_ok, false)
      and biological_indicator_result is distinct from 'FAIL')
) not valid;
alter table public.sterilization_releases validate constraint sterilization_releases_released_checks;

-- 2 -----------------------------------------------------------------------------------------------
create table public.release_transitions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_kind text not null check (asset_kind in ('SET', 'TOOL')),
  asset_id text not null,
  from_state text not null,
  to_state text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);
create index release_transitions_changed_at on public.release_transitions (changed_at);
-- Written only by the trigger below and read only by the integrity checks (as the database owner).
alter table public.release_transitions enable row level security;
revoke all on public.release_transitions from public, anon, authenticated;

create or replace function public.log_release_transition() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is not null then
    insert into public.release_transitions (organization_id, asset_kind, asset_id, from_state, to_state, changed_by)
    values (new.organization_id, case when tg_table_name = 'instrument_sets' then 'SET' else 'TOOL' end,
            new.id, old.state, new.state, auth.uid());
  end if;
  return null;
end $fn$;
revoke execute on function public.log_release_transition() from public, anon, authenticated;

create trigger instrument_sets_release_transition after update of state on public.instrument_sets
  for each row
  when (new.state in ('IN_STORAGE', 'READY_FOR_PICKUP')
        and old.state in ('PENDING_STERILIZATION', 'IN_WASHING', 'IN_PREPARATION', 'IN_PACKAGING',
                          'IN_STERILIZATION', 'AWAITING_RELEASE'))
  execute function public.log_release_transition();
create trigger instruments_release_transition after update of state on public.instruments
  for each row
  when (new.mode is distinct from 'SET_MEMBER'
        and new.state in ('IN_STORAGE', 'READY_FOR_PICKUP')
        and old.state in ('PENDING_STERILIZATION', 'IN_WASHING', 'IN_PREPARATION', 'IN_PACKAGING',
                          'IN_STERILIZATION', 'AWAITING_RELEASE'))
  execute function public.log_release_transition();
