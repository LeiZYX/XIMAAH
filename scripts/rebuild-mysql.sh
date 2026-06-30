#!/usr/bin/env bash
# Wipe MySQL data volume, recreate the mysql container, apply migrations, and seed.
#
# WARNING: Deletes ALL database data (users, registrations, fees, etc.).
#
# Usage:
#   chmod +x scripts/rebuild-mysql.sh
#   ./scripts/rebuild-mysql.sh
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

echo "WARNING: This will DELETE the MySQL volume and ALL database data."
echo "Project directory: $ROOT_DIR"
read -r -p "Type REBUILD to continue: " CONFIRM
if [ "$CONFIRM" != "REBUILD" ]; then
  echo "Aborted."
  exit 1
fi

if [ -t 0 ] && [ "${SKIP_BACKUP:-}" != "1" ]; then
  read -r -p "Create a backup first? [Y/n]: " DO_BACKUP
  DO_BACKUP="${DO_BACKUP:-Y}"
  if [[ "$DO_BACKUP" =~ ^[Yy]$ ]]; then
    "$SCRIPT_DIR/backup-mysql.sh" || true
  fi
fi

echo "==> Stopping app and removing MySQL volume"
docker compose stop app mysql 2>/dev/null || true
docker compose rm -f mysql 2>/dev/null || true

VOLUME_NAME="$(docker volume ls -q | grep mysql_data | head -1 || true)"
if [ -n "$VOLUME_NAME" ]; then
  echo "    Removing volume: $VOLUME_NAME"
  docker volume rm "$VOLUME_NAME"
else
  echo "    No mysql_data volume found (may already be removed)."
fi

echo "==> Starting fresh MySQL container"
docker compose up -d mysql

echo "==> Waiting for MySQL to become healthy (up to 90s)"
for _ in $(seq 1 18); do
  if docker compose exec -T mysql mysqladmin ping -h localhost -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent 2>/dev/null; then
    echo "    MySQL is ready."
    break
  fi
  sleep 5
done

if ! docker compose exec -T mysql mysqladmin ping -h localhost -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent 2>/dev/null; then
  echo "ERROR: MySQL did not become healthy in time."
  docker compose logs mysql --tail 50
  exit 1
fi

echo "==> Applying migrations"
docker compose run --rm app npx prisma migrate deploy

echo "==> Seeding database"
docker compose run --rm app npx prisma db seed

echo "==> Starting application"
docker compose up -d --build

echo ""
echo "MySQL rebuilt successfully."
echo "  docker compose exec app npx prisma migrate status"
echo "  docker compose logs -f app --tail=50"
echo ""
echo "Admin login uses ADMIN_EMAIL / ADMIN_PASSWORD from .env (see .env.production.example)."
