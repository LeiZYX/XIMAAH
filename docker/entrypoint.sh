#!/bin/sh
set -e

BACKUP_DIR="${BACKUP_DIRECTORY:-/var/backups/xima-assessment-hub}"
mkdir -p "$BACKUP_DIR"
chown -R nextjs:nodejs "$BACKUP_DIR"

exec gosu nextjs "$@"
