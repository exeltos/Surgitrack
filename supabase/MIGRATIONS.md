# Database migrations

`supabase/migrations/` holds every schema change of the live project, in the order it is applied. Replaying the whole
folder on an empty Postgres gives the same public schema as the live project (tables, columns, constraints, indexes,
policies, RLS flags, triggers and function bodies were compared; only the line endings inside six function bodies
differ, which is irrelevant to Postgres).

## How the versions line up

- A file's version is the version the live project recorded for it, so `supabase migration list` shows local and
  remote side by side. The first 31 files (2026-09-18 to 2026-09-29) and most later ones are exactly the migrations
  recorded in the live history; two live pairs (`sterilization_records_*`, `hospital_settings_*`) are two files each.
- Nine migrations were applied to the live project without being recorded in its history (they were run as plain SQL).
  Their effects are in the live schema, but the history does not list them, so they must be marked as applied
  there once, or `supabase db push` will try to run them again:

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

  ```bash
  supabase migration repair --status applied 20261003090000 20261003091000 20261003163500 20261003171500 \
    20261003173000 20261003201000 20261004121000 20261005090000 20261005133400
  ```

  Their versions were chosen so that the folder replays in the order the objects depend on each other (for example,
  `purchase_orders_demo_reset` must come after `purchase_orders`).

## From now on

- Create every change as a migration file, and apply it with the same version and name that the live project records
  (`supabase db push`, or the Supabase MCP `apply_migration`, then commit the file the tool reports).
- Never run schema changes as plain SQL without committing the matching migration file.
- A migration is never edited after it has been applied; add a new one.
