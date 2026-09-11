#!/usr/bin/env bash
# Delete all student users, candidates, registrations, and fee statements.
# Preserves admin/exam officer/teachers, default exam boards, and exam catalog.
#
# Usage (local):
#   CLEAR_STUDENT_DATA_CONFIRM=yes npm run db:clear-students
#
# Usage (Docker production):
#   ./scripts/clear-student-data.sh
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
echo "   - All student user accounts (role = STUDENT)"
echo "   - All candidates (internal and external)"
echo "   - All registration windows, workspaces, and registrations"
echo "   - All fee statements and related review/post-results data"
echo ""
echo " This will KEEP:"
echo "   - Admin, exam officer, and teacher accounts"
echo "   - Exam boards: EDEXCEL, CIE, AQA"
echo "   - Exam catalog (series, subjects, papers, sessions)"
echo "   - Fee schedules and fee rules"
echo "============================================================"
read -r -p "Type CLEAR-STUDENTS to continue: " CONFIRM
if [ "$CONFIRM" != "CLEAR-STUDENTS" ]; then
  echo "Aborted."
  exit 1
fi

if [ "${SKIP_BACKUP:-0}" != "1" ]; then
  echo "==> Backup before cleanup"
  "$SCRIPT_DIR/backup-mysql.sh"
else
  echo "==> Skipping backup (SKIP_BACKUP=1)"
fi

echo "==> Run student data cleanup"
docker compose run --rm --no-deps \
  -e CLEAR_STUDENT_DATA_CONFIRM=yes \
  -v "$ROOT_DIR/scripts:/app/scripts:ro" \
  app npx tsx /app/scripts/clear-student-data.ts

echo ""
echo "Cleanup complete. Re-import students from Admin → Users → Import."
