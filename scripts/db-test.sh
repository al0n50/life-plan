#!/usr/bin/env bash
# Build a throwaway Postgres database, apply every migration in order (twice, to prove
# they're safe to re-run), then run the security tests.
# Usage: scripts/db-test.sh   (needs psql; PG* env vars or a local server)
set -euo pipefail
shopt -s nullglob
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
cd "$(dirname "$0")/.."
DB="${TEST_DB:-lifeplan_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -v ON_ERROR_STOP=1 -q -X -d "$DB" -f "$1"; }
run supabase/tests/00_supabase_shim.sql
for pass in 1 2; do for f in supabase/migrations/*.sql; do echo "migrate ($pass): $f"; run "$f"; done; done
for f in supabase/tests/[1-9]*.sql; do echo "test: $f"; run "$f"; done
echo "All database tests passed."
