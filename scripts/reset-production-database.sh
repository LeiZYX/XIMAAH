#!/usr/bin/env bash
# Drop and recreate the MySQL database, apply all migrations, and seed sample data.
# WARNING: Deletes ALL application data (users, registrations, fees, etc.).
#
# Usage:
#   chmod +x scripts/reset-production-database.sh
#   ./scripts/reset-production-database.sh
#
# Optional: skip backup
#   SKIP_BACKUP=1 ./scripts/reset-production-database.sh
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

MYSQL_DATABASE="${MYSQL_DATABASE:-xima_assessment_hub}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is not set in .env}"

echo "============================================================"
echo " WARNING: This will DELETE ALL DATA in database:"
echo "   $MYSQL_DATABASE"
echo " Then recreate schema (21 migrations) and run prisma db seed."
echo "============================================================"
read -r -p "Type RESET to continue: " CONFIRM
if [ "$CONFIRM" != "RESET" ]; then
  echo "Aborted."
  exit 1
fi

if [ "${SKIP_BACKUP:-0}" != "1" ]; then
  echo "==> Backup before reset"
  "$SCRIPT_DIR/backup-mysql.sh"
else
  echo "==> Skipping backup (SKIP_BACKUP=1)"
fi

echo "==> Stop app container (keep MySQL running)"
docker compose stop app || true

echo "==> Drop and recreate database"
docker compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
DROP DATABASE IF EXISTS \`${MYSQL_DATABASE}\`;
CREATE DATABASE \`${MYSQL_DATABASE}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
SQL

echo "==> Apply all migrations"
docker compose exec -T app npx prisma migrate deploy

echo "==> Seed initial data (admin user, exam boards, sample records)"
docker compose exec -T app npx prisma db seed

echo "==> Start app"
docker compose up -d app

echo ""
echo "Reset complete."
echo "  Admin login: \${ADMIN_EMAIL:-admin@xima.local} / value from ADMIN_PASSWORD in .env"
echo ""
docker compose exec -T app npx prisma migrate status
