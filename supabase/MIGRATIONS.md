# Database migrations

`supabase/migrations/` holds every schema change of the live project, in the order it is applied. Replaying the whole
folder on an empty Postgres gives the same public schema as the live project. Last compared on 2026-10-09 with the
local replay below: policies, triggers and table and function privileges are identical, and function bodies differ
only in whitespace (`platform_delete_movements`).

The folder has 80 files: the 77 whose effects are live, and three not yet applied (see
[Waiting to be applied](#waiting-to-be-applied)).

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

To record the seven in the live history without running them again (it only writes rows in
`supabase_migrations.schema_migrations`; nothing in the schema changes):

```sh
supabase link --project-ref oklyqnoqzbhjudqbkulq
supabase migration repair --status applied 20261006130300 20261008080000 20261008120000 20261008130000 20261008140000 20261008150000 20261008160000
supabase migration list   # local and remote must now match up to 20261009091719
```

## Waiting to be applied

| Version        | Name                     | What it does                                                                                                            |
| -------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 20261009120000 | lock_default_privileges  | No anon/PUBLIC by default on new objects; revokes the anon grants that came back; `{public}` policies and Demo policies |
| 20261009120100 | supervisor_rights_in_rls | The Sterilization supervisor's rights and the Studio role settings enforced by the database                             |
| 20261009120200 | append_only_audit        | `configuration_audit`: the configuration history, copied server side from `hospital_settings`, never changed            |

After the repair above, apply them in this order with `supabase db push` (it applies the files with their own versions
and names, so local and remote keep matching), then check `supabase migration list` and the advisors. Applying them
through the Supabase MCP `apply_migration` records a new version instead: rename the files to the versions it reports.

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
