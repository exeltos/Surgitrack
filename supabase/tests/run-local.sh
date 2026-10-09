#!/usr/bin/env bash
# Replays every migration in supabase/migrations on a throwaway local PostgreSQL 16 and runs the SQL
# tests in supabase/tests/sql against it. Never touches the live project.
#
#   bash supabase/tests/run-local.sh            # temporary cluster, removed afterwards
#   KEEP=1 bash supabase/tests/run-local.sh     # keep the cluster running and print how to connect
#   RESTORE_DUMP=backup.dump bash supabase/tests/run-local.sh
#       # restore test of a data-only backup (pg_dump --data-only --schema=public -Fc): loads it onto the
#       # replayed schema and writes "table rows" lines to RESTORE_COUNTS (default restore-counts.txt)
#
# Needs the PostgreSQL 16 server binaries (initdb, pg_ctl) and psql. When run as root, the cluster
# runs as the `postgres` OS user.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
export SURGITRACK_REPO="$repo"
pgbin="${PGBIN:-/usr/lib/postgresql/16/bin}"
[ -x "$pgbin/initdb" ] || pgbin="$(dirname "$(command -v initdb)")"

work="$(mktemp -d)"
chmod 755 "$work"
as_owner() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
if [ "$(id -u)" = 0 ]; then chown postgres "$work"; fi

port="${PGPORT_TEST:-$((20000 + RANDOM % 20000))}"
cleanup() {
  if [ "${KEEP:-}" = 1 ]; then
    echo "Cluster kept: psql -h $work -p $port -U supabase_admin surgitrack_test"
  else
    as_owner "$pgbin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$work"
  fi
}
trap cleanup EXIT

as_owner "$pgbin/initdb" -D "$work/data" -U supabase_admin -A trust --no-sync >/dev/null
as_owner "$pgbin/pg_ctl" -D "$work/data" -l "$work/server.log" \
  -o "-k $work -p $port -c listen_addresses='' -c fsync=off -c wal_level=logical" -w start >/dev/null

psql_su() { psql -X -q -v ON_ERROR_STOP=1 -h "$work" -p "$port" -U supabase_admin "$@"; }
psql_su -d postgres -c "create database surgitrack_test"
psql_su -d surgitrack_test -f "$here/local/bootstrap.sql" >/dev/null

# pg_cron and pg_net are not part of a plain PostgreSQL; bootstrap.sql stubs the functions they provide.
have_ext() { psql_su -d surgitrack_test -tAc "select 1 from pg_available_extensions where name = '$1'" | grep -q 1; }
filter='cat'
have_ext pg_cron || filter="$filter | sed -E 's/^create extension if not exists pg_cron;/-- (pg_cron stubbed)/I'"
have_ext pg_net || filter="$filter | sed -E 's/^create extension if not exists pg_net;/-- (pg_net stubbed)/I'"

count=0
for f in "${MIGRATIONS_DIR:-$repo/supabase/migrations}"/*.sql; do
  if ! eval "$filter" <"$f" | psql -X -q -v ON_ERROR_STOP=1 --single-transaction -h "$work" -p "$port" \
    -U postgres -d surgitrack_test -f - >"$work/migration.log" 2>&1; then
    echo "FAILED: $(basename "$f")"
    cat "$work/migration.log"
    exit 1
  fi
  count=$((count + 1))
done
echo "Replayed $count migrations."

if [ -n "${RESTORE_DUMP:-}" ]; then
  # Rows the migrations seed (settings, libraries) come back from the backup itself.
  psql_su -d surgitrack_test -c "do \$\$ begin execute (select 'truncate ' || string_agg(format('public.%I', relname), ', ')
      || ' cascade' from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')); end \$\$"
  # Superuser, so that --disable-triggers also skips the foreign keys to auth.users (not in the backup).
  "$pgbin/pg_restore" --data-only --disable-triggers --exit-on-error --no-owner --no-privileges -h "$work" -p "$port" \
    -U supabase_admin -d surgitrack_test "$RESTORE_DUMP"
  psql_su -d surgitrack_test -tA -F ' ' -c "select format('%s %s', c.relname,
      (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text)
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') order by 1" \
    >"${RESTORE_COUNTS:-restore-counts.txt}"
  echo "Restored $(basename "$RESTORE_DUMP"): $(wc -l <"${RESTORE_COUNTS:-restore-counts.txt}") tables counted."
  exit 0
fi

failed=0
shopt -s nullglob
for t in "$here"/sql/*.sql; do
  if psql -X -q -v ON_ERROR_STOP=1 -h "$work" -p "$port" -U postgres -d surgitrack_test -f "$t" >"$work/test.log" 2>&1; then
    echo "ok   $(basename "$t")"
    grep -E '^(psql:.*)?NOTICE:' "$work/test.log" | sed -E 's/^.*NOTICE: +/       /' || true
  else
    echo "FAIL $(basename "$t")"
    cat "$work/test.log"
    failed=1
  fi
done
exit $failed
