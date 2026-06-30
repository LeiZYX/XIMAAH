#!/usr/bin/env bash
# Regenerate deploy/database/xima_assessment_hub_baseline.sql.gz from local MySQL.
# Requires dev MySQL on localhost:3306 (see .env DATABASE_URL).
#
# Usage:
#   chmod +x scripts/export-baseline-database.sh
#   ./scripts/export-baseline-database.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BASELINE="$ROOT_DIR/deploy/database/xima_assessment_hub_baseline.sql.gz"
MYSQL_DATABASE="${MYSQL_DATABASE:-xima_assessment_hub}"

echo "==> Applying migrations"
npx prisma migrate deploy

echo "==> Seeding database"
npx prisma db seed

echo "==> Exporting baseline dump to $BASELINE"
mkdir -p "$(dirname "$BASELINE")"

if docker ps --format '{{.Names}}' | grep -qx 'xima-mysql'; then
  docker exec xima-mysql mysqldump \
    -uroot -prootpassword \
    --single-transaction --routines --triggers \
    --databases "${MYSQL_DATABASE}" \
    | gzip > "$BASELINE"
elif docker ps --format '{{.Names}}' | grep -qx 'xima-mysql-dev'; then
  docker exec xima-mysql-dev mysqldump \
    -uroot -prootpassword \
    --single-transaction --routines --triggers \
    --databases "${MYSQL_DATABASE}" \
    | gzip > "$BASELINE"
else
  echo "ERROR: Start local MySQL (xima-mysql or xima-mysql-dev) first."
  exit 1
fi

ls -lh "$BASELINE"
echo "Done. Commit deploy/database/xima_assessment_hub_baseline.sql.gz to GitHub."
