#!/usr/bin/env bash
# Clear registration windows, exam registrations, fee statements, and related data.
# Preserves user accounts (test users) and the three default exam boards (EDEXCEL, CIE, AQA).
# Keeps exam catalog (subjects, papers, sessions) and fee schedules.
#
# Usage (local):
#   CLEAN_REGISTRATION_DATA_CONFIRM=yes npm run db:cleanup-registration-data
#
# Usage (Docker):
#   ./scripts/cleanup-registration-data.sh
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

echo "============================================================"
echo " This will DELETE:"
echo "   - All registration windows and registrations"
echo "   - All fee statements and fee audit logs"
echo "   - All review windows and post-results requests"
echo "   - All candidates (re-created from student users)"
echo ""
echo " This will KEEP:"
echo "   - User accounts (admin, exam officer, teachers, students)"
echo "   - Exam boards: EDEXCEL, CIE, AQA"
echo "   - Exam catalog (series, subjects, papers, sessions)"
echo "   - Fee schedules"
echo "============================================================"
read -r -p "Type CLEAN to continue: " CONFIRM
if [ "$CONFIRM" != "CLEAN" ]; then
  echo "Aborted."
  exit 1
fi

if [ "${SKIP_BACKUP:-0}" != "1" ]; then
  echo "==> Backup before cleanup"
  "$SCRIPT_DIR/backup-mysql.sh"
else
  echo "==> Skipping backup (SKIP_BACKUP=1)"
fi

echo "==> Run cleanup"
docker compose exec -T -e CLEAN_REGISTRATION_DATA_CONFIRM=yes app npx tsx scripts/cleanup-registration-data.ts

echo ""
echo "Cleanup complete."
