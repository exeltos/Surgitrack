# Database migrations

`supabase/migrations/` holds every schema change of the live project, in the order it is applied. Replaying the whole
folder on an empty Postgres gives the same public schema as the live project. Last compared on 2026-10-09 with the
local replay below: policies, triggers and table and function privileges are identical, and function bodies differ
only in whitespace (`platform_delete_movements`).

The folder has 105 files, all applied to the live project (checked 10/10/2026; `20261014063143_department_pickup`,
`20261014102205_usage_correction`, `20261014124438_demo_handover_stamp` and `20261014134551_recreated_records_forget_deletion`
applied and recorded on 14/10/2026, `20261026113029_department_cancel_dispatch` on 26/10/2026 and
`20261027082127_hospital_modules` and `20261027094320_hospital_module_devices` on 27/10/2026, and the twelve of 01/11/2026 listed below (and `20261103090000` of 03/11/2026), each file named after the version the live project gave it).

## Applied on 01/11/2026 (from the review of that day)

| Version        | Name                                         | What it does                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20261101203245 | client_errors_rate_cap                       | At most 60 error reports an hour per signed-in account                                                                                                                                                                                                                                                                                                                                   |
| 20261101203313 | access_request_token_and_pending_email_guard | `confirm_token` of staff_access_requests unreadable by signed-in users; a direct write cannot activate an account whose signup email is unconfirmed                                                                                                                                                                                                                                      |
| 20261101203341 | trial_lock_storage                           | The trial lock also covers the `surgitrack-assets` Storage bucket                                                                                                                                                                                                                                                                                                                        |
| 20261101203352 | profile_contacts_function                    | `profile_contacts()`: sign-in email and username for a hospital's admins, the platform owner, or the caller's own row                                                                                                                                                                                                                                                                    |
| 20261101203835 | admin_accounts_owner_only                    | A hospital admin no longer changes or removes another admin's account by a direct write (the staff functions refuse it too); only the platform owner does                                                                                                                                                                                                                                |
| 20261101210816 | hide_profile_contacts                        | Signed-in users cannot read `profiles.email` and `profiles.user_code` from the table; the app reads them through `profile_contacts()`                                                                                                                                                                                                                                                    |
| 20261101230000 | demo_seats_left_caller_check                 | `demo_seats_left(org)` answers only for the caller's own hospital, the platform owner and the service role                                                                                                                                                                                                                                                                               |
| 20261102080000 | admin_role_owner_only                        | A trigger on `profiles`: a signed-in hospital admin cannot give anyone the Admin role (direct write, or approving a signup as Admin); `update-staff` v21 and `invite-staff` v24 refuse it too (`owner_only`)                                                                                                                                                                             |
| 20261102100000 | email_change_requests                        | A hospital admin's change of another person's sign-in email waits for the new address to confirm it (`email_change_requests`, service role only); `update-staff` v23 and `staff-signup` v26                                                                                                                                                                                              |
| 20261102120000 | platform_owner_setting                       | The platform owner's address moves from the code into the private row `platform_owner`; `caller_is_platform_owner()` lets the app ask about it (applied before the app that asks it)                                                                                                                                                                                                     |
| 20261102140000 | login_attempts_purge                         | The nightly job also clears `login_attempts` (the rate limiter's table, never purged until now) of rows older than a day; `device-ingest` v16 limits a device key and unknown keys per address                                                                                                                                                                                           |
| 20261102160000 | login_limit_per_address                      | `reserve_login_attempt` can also count per username AND address; sign-in (`login-with-code` v17) locks the address first (5), then the username (30) and the address (20)                                                                                                                                                                                                                |
| 20261104184718 | ip_access                                    | Access by network: `ip_access` (mode OFF / LOG / ENFORCE, allowed addresses, exempt people), `ip_access_log`; `current_org_id()` is null for someone outside the allowed addresses, so row security shows them nothing (the platform owner and the exempt people are never held); `my_ip_access()` for the app, `platform_set_ip_access()` for the owner                                 |
| 20261103090000 | staff_import_first_password                  | `profiles.password_change_required` / `_deadline`: until the first password is replaced the database shows the person none of the hospital's data; nightly `lock_unchanged_passwords()`; applied before the app that asks for the columns. Functions: `import-staff` v1, `change-initial-password` v1, `update-staff` v24, `verify-handover` v18                                         |
| 20261109150000 | notice_audience_and_promotions               | **Not applied yet.** `platform_notices` gets `kind` (notice / promotion), `audience` (everyone / administrators), `title`, `link_url` (https only), `link_label`, `organization_ids`; reading narrows to the hospital and role (the platform owner reads all). Apply it before publishing the app that uses it; the app also works against the old table (falls back to the old columns) |
| 20261109170000 | notice_image                                 | **Not applied yet.** `platform_notices.image_url` (https only): the picture of a promotion. Needs `20261109150000` first; the app falls back to the columns without it                                                                                                                                                                                                                   |
| 20261109180000 | promo_images_bucket                          | **Not applied yet.** Public Storage bucket `promo-images` (2 MB, JPEG/PNG/WebP); only the platform owner may add or delete files. The owner uploads the picture of a promotion from Studio                                                                                                                                                                                               |

Applied with the Supabase MCP `apply_migration` after a fresh platform backup (01/11/2026 01:40 UTC) and read-only
checks of the live schema; each file is named after the version the project recorded. After each one the checks of
`docs/RUNBOOK-database-rollout.md` gave the expected result. The same day the three staff functions that enforce the same
rule (`delete-staff` v14, `staff-link` v12, `update-staff` v16, which keeps `verify_jwt = false` as it had) were deployed;
`update-staff` was not listed in `config.toml` for that setting; it is now (`verify_jwt = false`, as live), so the repository and the live project agree.

`20261101210816_hide_profile_contacts` had already been run by hand in the Dashboard at 15:29 UTC, before the app that
reads contacts through `profile_contacts()` was published; the migration of 21:08 UTC changed nothing and recorded the
version (see the comment in the file).

Edge functions deployed on 02/11/2026 without a migration: `staff-signup` v25 (every signup counts against the limits: 30 an hour per address, 200 an hour per hospital link, 5 a day per email address).

## How the versions line up

- A file's version is the version the live project recorded for it, so `supabase migration list` shows local and
  remote side by side. The first 31 files (2026-09-18 to 2026-09-29) and most later ones are exactly the migrations
  recorded in the live history; two live pairs (`sterilization_records_*`, `hospital_settings_*`) are two files each.
- Nine migrations were applied to the live project as plain SQL, so they were missing from its history. Their effects
  were already in the live schema; on 2026-10-05 they were recorded there (with an empty `statements` list, since the
  SQL itself lives in this folder):

  | Version        | Name                        |
  | -------------- | --------------------------- |
  | 20261003090000 | instrument_tables           |
  | 20261003091000 | drop_unused_draft_tables    |
  | 20261003163500 | instrument_cleanup          |
  | 20261003171500 | reset_and_rename_new_tables |
  | 20261003173000 | finish_app_records          |
  | 20261003201000 | undo_asset_import           |
  | 20261004121000 | undo_import_hospital_roles  |
  | 20261005090000 | manufacturers_from_assets   |
  | 20261005133400 | purchase_orders_demo_reset  |

  Their versions were chosen so that the folder replays in the order the objects depend on each other (for example,
  `purchase_orders_demo_reset` must come after `purchase_orders`).

## History drift found on 2026-10-09

The live history lists 70 versions; 77 files here are live. It happened again: seven migrations were applied as plain
SQL (their effects are in the live schema, as the comparison above shows) but are missing from the live history:

| Version        | Name                            |
| -------------- | ------------------------------- |
| 20261006130300 | recycle_bin_demo_reset          |
| 20261008080000 | platform_delete_movements       |
| 20261008120000 | department_update_guard         |
| 20261008130000 | rls_initplan_and_change_indexes |
| 20261008140000 | history_recorded_by             |
| 20261008150000 | realtime_and_deleted_records    |
| 20261008160000 | version_check                   |

And `recycle_bin_more_kinds` was recorded live as `20261006150203`, while its file here was `20261006160000`. The file
was renamed to `20261006150203_recycle_bin_more_kinds.sql` to match the live history (the replay order is unchanged:
it still runs right after `20261006140426_revoke_anon_table_grants`).

The seven were recorded in the live history on 09/10/2026 (rows in `supabase_migrations.schema_migrations` only;
nothing in the schema changed). With the CLI the same is
`supabase migration repair --status applied <versions>`.

## Applied on 09/10/2026

| Version        | Name                         | What it does                                                                                                                                   |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 20261009120000 | lock_default_privileges      | No anon/PUBLIC by default on new objects; revokes the anon grants that came back; `{public}` policies and Demo policies                        |
| 20261009120100 | supervisor_rights_in_rls     | The Sterilization supervisor's rights and the Studio role settings enforced by the database                                                    |
| 20261009120200 | append_only_audit            | `configuration_audit`: the configuration history, copied server side from `hospital_settings`, never changed                                   |
| 20261010090000 | account_safety               | Sign-in email and username change only through the staff functions; `account_events`; platform owner claimed only once, with a confirmed email |
| 20261010120000 | handover_and_usage_integrity | Usage counts never go down; `handover_signatures` and the `counterparty_verified` stamp on receipts and deliveries                             |
| 20261010150000 | signup_email_confirmation    | `confirm_token` on staff_access_requests: a hospital-link signup reaches the admin only after its email is confirmed                           |

They were applied through the Supabase MCP `execute_sql`, with their own versions recorded by hand, because that tool
times out on any statement it treats as destructive (`drop`). The `drop ... if exists` lines guarding new objects
were skipped (nothing to drop). The nine `drop policy` lines of `20261009120000` that removed the replaced Demo
policies have since been run and the version is recorded (checked 09/10/2026: each Demo table has exactly one
policy per action). For the record, they were:

```sql
drop policy if exists demo_accounts_owner on public.demo_accounts;
drop policy if exists demo_accounts_own_read on public.demo_accounts;
drop policy if exists demo_guide_progress_own on public.demo_guide_progress;
drop policy if exists demo_guide_progress_owner on public.demo_guide_progress;
drop policy if exists demo_feedback_own on public.demo_feedback;
drop policy if exists demo_feedback_owner on public.demo_feedback;
drop policy if exists demo_requests_own_insert on public.demo_requests;
drop policy if exists demo_requests_own_read on public.demo_requests;
drop policy if exists demo_requests_owner on public.demo_requests;
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261009120000', 'lock_default_privileges', array[]::text[]) on conflict (version) do nothing;
```

## Applied on 10/10/2026

| Version        | Name              | What it does                                                                                                                                                                    |
| -------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20261010152714 | release_integrity | A RELEASED release needs acceptable parameters, intact packaging and no failed biological indicator; ready straight from a sterilization stage is logged for the nightly checks |

Applied with the Supabase MCP `apply_migration`, which recorded the version itself; the file carries that version.
Before it, no saved release broke the new check (one release, a REPROCESS), so the migration validates it at once.
Checked afterwards: the check is validated, `release_transitions` has row level security and no grants to `anon`
or `authenticated`, the trigger function is not callable by them, and `supabase/integrity.sql` finds nothing. The
security advisor notes `release_transitions` as "RLS enabled, no policy", on purpose, like `device_keys`.

## Testing locally

```sh
bash supabase/tests/run-local.sh
```

Starts a throwaway PostgreSQL 16 (initdb in a temporary folder; the live project is never touched), creates the few
things the Supabase platform provides (`supabase/tests/local/bootstrap.sql`: the roles, `auth.users` and `auth.uid()`,
storage, vault, cron and net stubs, the realtime publication, the platform's default privileges), replays every
migration as `postgres` (not a superuser, as on the platform), then runs each file in `supabase/tests/sql/`. A test
acts as a user by setting the role and `request.jwt.claims` as PostgREST does (`tests.login('ster_a')`); the people
and hospitals it uses are in `supabase/tests/local/fixtures.sql`. Each test file runs in a transaction that is rolled
back. `KEEP=1` leaves the database running to look around; `MIGRATIONS_DIR=...` replays another folder.

## From now on

- Create every change as a migration file, and apply it with the same version and name that the live project records
  (`supabase db push`, or the Supabase MCP `apply_migration`, then commit the file the tool reports).
- Never run schema changes as plain SQL without committing the matching migration file. When it cannot be avoided
  (the MCP tool times out on statements it treats as destructive), record the version right after with
  `supabase migration repair --status applied <version>`.
- A migration is never edited after it has been applied; add a new one.
- Run `bash supabase/tests/run-local.sh` before applying a migration, and add a test for what it changes.
- A new function that signed-out visitors must call needs an explicit `grant execute ... to anon`; nothing gets it by
  default any more.

## Data fixes applied by hand

- **09/10/2026, date format.** Ten `movements.at` and four `receipts.at` values written by an older version in the
  browser's Greek short form (`8/10/26, 1:06 μ.μ.`) were rewritten in the app's single format (`08/10/2026 13:06`),
  checked against the time inside each record's id. The app still reads the old form, so cached copies on devices
  are harmless.

## Integrity checks

`supabase/integrity.sql` lists, per hospital, what foreign keys would have refused (instruments in a missing Set,
Set members without a Set, Set counts that differ from their instruments). There are deliberately no such keys:
devices sync offline and send each collection on its own. The nightly backup workflow runs the checks against the
live database and fails (emailing the owner) when any row comes back; `supabase/tests/sql/07_integrity.sql` tests
them. Checked live on 09/10/2026: no problem.
