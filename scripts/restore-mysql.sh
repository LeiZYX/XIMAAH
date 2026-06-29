#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup.sql|backup.sql.gz>"
  exit 1
fi

BACKUP_PATH="$1"
if [ ! -f "$BACKUP_PATH" ]; then
  echo "Backup file not found: $BACKUP_PATH"
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is not set in .env}"

echo "WARNING: This will overwrite data in the MySQL database."
read -r -p "Type RESTORE to continue: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

echo "Restoring from $BACKUP_PATH"

if [[ "$BACKUP_PATH" == *.gz ]]; then
  gunzip -c "$BACKUP_PATH" | docker compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}"
else
  docker compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" < "$BACKUP_PATH"
fi

echo "Restore complete."
