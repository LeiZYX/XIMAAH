#!/usr/bin/env bash
# Rebuild MySQL container and import baseline database from Git.
#
# Usage (production server):
#   cp .env.production .env   # first time, or when env changes
#   chmod +x scripts/restore-baseline-database.sh
#   ./scripts/restore-baseline-database.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

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

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is not set in .env}"

echo "WARNING: This deletes the MySQL volume and restores from baseline dump."
read -r -p "Type RESTORE to continue: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

echo "==> Stopping services and removing MySQL volume"
docker compose stop app mysql 2>/dev/null || true
docker compose rm -f mysql 2>/dev/null || true
VOLUME_NAME="$(docker volume ls -q | grep mysql_data | head -1 || true)"
if [ -n "$VOLUME_NAME" ]; then
  docker volume rm "$VOLUME_NAME"
fi

echo "==> Starting MySQL"
docker compose up -d mysql

echo "==> Waiting for MySQL"
for _ in $(seq 1 18); do
  if docker compose exec -T mysql mysqladmin ping -h localhost -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent 2>/dev/null; then
    break
  fi
  sleep 5
done

echo "==> Importing baseline database"
gunzip -c "$BASELINE" | docker compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}"

echo "==> Starting application"
docker compose up -d --build

echo ""
echo "Restore complete."
docker compose exec app npx prisma migrate status || true
echo "Admin login: see ADMIN_EMAIL / ADMIN_PASSWORD in .env.production"
