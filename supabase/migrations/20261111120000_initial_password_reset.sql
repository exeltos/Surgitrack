-- An administrator can reset a person's account to a first password by hand: they type the person's mobile number (the
-- number is only the new first password, it is not kept anywhere) and the person has to choose their own at the next
-- sign-in, within a week. The audit trail records the reset (never the number).
alter table public.account_events drop constraint if exists account_events_action_check;
alter table public.account_events add constraint account_events_action_check
  check (action in ('password_link', 'invite_link', 'email_changed', 'email_change_requested', 'staff_imported',
                    'initial_password_reset'));
