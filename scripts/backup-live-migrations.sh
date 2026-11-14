#!/usr/bin/env bash
# Nightly backup: the migrations already applied to the live database but not yet in this checkout.
#
# A migration is applied to production just before its pull request is merged, so the feature works the moment it
# ships. A backup that runs in between finds a table that the repository does not create yet, and its restore test
# fails although nothing is wrong. This writes each such migration from the live migration history (Supabase keeps
# the SQL of every migration applied with apply_migration) into the migrations folder of this checkout, so the
# restore replays it too, and warns about it. A change made to the live database outside a migration is not in that
# history, so it still makes the restore fail, as it should.
#
#   SUPABASE_DB_URL=... bash scripts/backup-live-migrations.sh [migrations-dir]
set -euo pipefail
dir="${1:-supabase/migrations}"
psql_live() { "${PSQL:-psql}" "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 -tA "$@"; }

known="$(ls "$dir" | sed -E 's/_.*//' | sort -u)"
pending=0
while read -r version name; do
  [ -n "$version" ] || continue
  # Only what a migration's version and name can be: nothing from the database reaches a path otherwise.
  if ! [[ "$version" =~ ^[0-9]{14}$ && "$name" =~ ^[a-z0-9_]+$ ]]; then
    echo "::error::Unexpected migration in the live history: '$version' '$name'."
    exit 1
  fi
  grep -qx "$version" <<<"$known" && continue
  psql_live -c "select array_to_string(statements, E';\n') from supabase_migrations.schema_migrations where version = '$version'" \
    >"$dir/${version}_${name}.sql"
  echo "::warning::Migration ${version}_${name} is live but not yet in main: replayed from the live history for this restore test."
  pending=$((pending + 1))
done < <(psql_live -F ' ' -c "select version, name from supabase_migrations.schema_migrations order by version")
echo "$pending live migration(s) not yet in main."
