#!/usr/bin/env bash
# Brings the STAGING database up to date with supabase/migrations: applies, in order, the files it has not seen
# yet (each in its own transaction, together with the note that it was applied), and switches off every
# scheduled job that points at the production project. Safe to run again: files already applied are skipped.
#
#   STAGING_DB_URL=postgresql://postgres.<ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres \
#     bash scripts/staging/apply-migrations.sh
#
# It refuses to run unless the URL names the staging project, and never against production.
set -euo pipefail

: "${STAGING_DB_URL:?Set STAGING_DB_URL to the Session pooler connection string of the staging project.}"
STAGING_REF="${STAGING_REF:-fmxdyprtsgjkqrmejhah}"
PRODUCTION_REF="oklyqnoqzbhjudqbkulq"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dir="${MIGRATIONS_DIR:-$here/../../supabase/migrations}"

case "$STAGING_DB_URL" in
  *"$PRODUCTION_REF"*) echo "Refusing: this connection string names the PRODUCTION project." >&2; exit 1 ;;
esac
case "$STAGING_DB_URL" in
  *"$STAGING_REF"*) ;;
  *) echo "Refusing: the connection string does not name the staging project ($STAGING_REF)." >&2; exit 1 ;;
esac

run() { psql "$STAGING_DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }
# Only for the local test: a plain PostgreSQL has no pg_cron / pg_net (see supabase/tests/run-local.sh).
filter=cat
if [ "${STAGING_STUB_EXTENSIONS:-}" = 1 ]; then
  filter="sed -E s/^create[[:space:]]+extension[[:space:]]+if[[:space:]]+not[[:space:]]+exists[[:space:]]+(pg_cron|pg_net);/--stubbed/I"
fi

run -c "create schema if not exists staging_meta; create table if not exists staging_meta.applied_migrations (file text primary key, applied_at timestamptz not null default now());"

applied=0
skipped=0
for f in "$dir"/*.sql; do
  name="$(basename "$f")"
  if [ "$(run -tA -c "select count(*) from staging_meta.applied_migrations where file = '$name'")" != 0 ]; then
    skipped=$((skipped + 1))
    continue
  fi
  echo "applying $name"
  tmp="$(mktemp)"
  $filter <"$f" >"$tmp"
  run --single-transaction -f "$tmp" -c "insert into staging_meta.applied_migrations (file) values ('$name')"
  rm -f "$tmp"
  applied=$((applied + 1))
done
echo "Migrations: $applied applied, $skipped already there."

# Scheduled jobs written for production (the Demo round, the reminder emails) must not run from here.
run -c "do \$\$
declare j record;
begin
  if to_regclass('cron.job') is not null then
    for j in select jobid from cron.job where command ilike '%${PRODUCTION_REF}%' loop
      perform cron.unschedule(j.jobid);
    end loop;
    if exists (select 1 from cron.job where command ilike '%${PRODUCTION_REF}%') then
      raise exception 'a scheduled job still points at production';
    end if;
  end if;
end \$\$;"
echo "No scheduled job points at production."
