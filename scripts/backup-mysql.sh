#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/mysql-root.sh"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MYSQL_DATABASE="${MYSQL_DATABASE:-xima_assessment_hub}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is not set in .env}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/mysql}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/${MYSQL_DATABASE}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up database '$MYSQL_DATABASE' to $BACKUP_FILE"

docker compose exec -T mysql mysqldump \
  -uroot \
  -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  --databases "${MYSQL_DATABASE}" \
  | gzip > "$BACKUP_FILE"

echo "Backup complete: $BACKUP_FILE"
