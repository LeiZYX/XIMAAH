#!/usr/bin/env bash
# Rebuild MySQL container and import baseline database from Git.
#
# Usage (production server):
#   cp .env.production .env
#   chmod +x scripts/restore-baseline-database.sh
#   ./scripts/restore-baseline-database.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/mysql-root.sh"

BASELINE="$ROOT_DIR/deploy/database/xima_assessment_hub_baseline.sql.gz"

if [ ! -f "$BASELINE" ]; then
  echo "ERROR: Baseline dump not found: $BASELINE"
  echo "Run scripts/export-baseline-database.sh on dev and commit the file."
  exit 1
fi

if [ ! -f .env ] && [ -f .env.production ]; then
  echo "==> Copying .env.production to .env"
  cp .env.production .env
fi

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Run: cp .env.production .env"
  exit 1
fi

echo "WARNING: This deletes the MySQL volume and restores from baseline dump."
read -r -p "Type RESTORE to continue: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

echo "==> Stopping services and removing MySQL data volume"
docker compose stop app 2>/dev/null || true
docker compose down -v --remove-orphans 2>/dev/null || true

echo "==> Starting MySQL with credentials from .env"
docker compose up -d mysql

echo "==> Waiting for MySQL (up to 90s)"
READY=0
for _ in $(seq 1 18); do
  if mysql_root_ping 2>/dev/null; then
    READY=1
    echo "    MySQL is ready."
    break
  fi
  sleep 5
done

if [ "$READY" -ne 1 ]; then
  echo "ERROR: MySQL did not become ready."
  echo "Check .env matches the password used to initialize MySQL:"
  echo "  grep MYSQL_ROOT_PASSWORD .env"
  echo "  docker compose exec mysql printenv MYSQL_ROOT_PASSWORD"
  docker compose logs mysql --tail 50
  exit 1
fi

echo "==> Importing baseline database"
gunzip -c "$BASELINE" | mysql_root_import_stdin

echo "==> Starting application"
docker compose up -d --build

echo ""
echo "Restore complete."
docker compose exec app npx prisma migrate status || true
echo "Admin login: see ADMIN_EMAIL / ADMIN_PASSWORD in .env.production"
