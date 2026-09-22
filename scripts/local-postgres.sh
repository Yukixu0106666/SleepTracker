#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."

# Dedicated development cluster. Never touches an existing Homebrew database.
task_pg_bin="${SLEEPTRACKER_PG_BIN:-}"
if [ -z "$task_pg_bin" ]; then
  for task_candidate in /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin; do
    if [ -x "$task_candidate/initdb" ]; then task_pg_bin="$task_candidate"; break; fi
  done
fi
if [ -z "$task_pg_bin" ] && command -v initdb >/dev/null 2>&1; then
  task_pg_bin="$(dirname -- "$(command -v initdb)")"
fi
if [ ! -x "$task_pg_bin/initdb" ]; then
  echo 'PostgreSQL binaries not found. Set SLEEPTRACKER_PG_BIN or use compose.ingestion.yml.' >&2
  exit 1
fi
task_pg_dir="$PWD/.local/postgres"
if [ "${1:-start}" = stop ]; then
  "$task_pg_bin/pg_ctl" -D "$task_pg_dir" stop -m fast
  exit 0
fi
if [ "${1:-start}" != start ]; then echo 'Use start or stop' >&2; exit 1; fi
mkdir -p "$PWD/.local"
chmod 700 "$PWD/.local"
if [ ! -f "$task_pg_dir/PG_VERSION" ]; then
  task_password_file="$(mktemp "$PWD/.local/pg-password.XXXXXX")"
  trap 'rm -f -- "$task_password_file"' EXIT
  printf '%s\n' 'sleeptracker_dev' > "$task_password_file"
  "$task_pg_bin/initdb" -D "$task_pg_dir" -U sleeptracker --auth-host=scram-sha-256 --auth-local=trust --pwfile="$task_password_file" --no-locale -E UTF8
fi
if ! "$task_pg_bin/pg_ctl" -D "$task_pg_dir" status >/dev/null 2>&1; then
  "$task_pg_bin/pg_ctl" -D "$task_pg_dir" -l "$PWD/.local/postgres.log" -o '-h 127.0.0.1 -p 54329' start
fi
task_db_exists="$(PGPASSWORD=sleeptracker_dev "$task_pg_bin/psql" -h 127.0.0.1 -p 54329 -U sleeptracker -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = 'sleeptracker'")"
if [ "$task_db_exists" != 1 ]; then
  PGPASSWORD=sleeptracker_dev "$task_pg_bin/createdb" -h 127.0.0.1 -p 54329 -U sleeptracker sleeptracker
fi
echo 'Local development PostgreSQL ready on 127.0.0.1:54329 (database: sleeptracker).'
