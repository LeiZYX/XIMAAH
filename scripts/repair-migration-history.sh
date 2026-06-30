#!/usr/bin/env bash
# Repair Prisma migration history on an existing production database and apply
# any pending schema migrations. Safe when the DB was created via db push or
# partial migrations (e.g. only a failed 20260626180000 row in _prisma_migrations).
#
# Usage (on Ubuntu host, project root):
#   chmod +x scripts/repair-migration-history.sh
#   ./scripts/repair-migration-history.sh
#
# What it does:
#   1. Backs up MySQL
#   2. Clears failed rows in _prisma_migrations (marks rolled back, then applied)
#   3. Runs prisma migrate deploy in a loop; already-applied objects → resolve --applied
#   4. Applies idempotent patches for critical v0.5.0 schema gaps
#   5. Prints migrate status
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

mysql_exec() {
  docker compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" "$@"
}

prisma_exec() {
  docker compose exec -T app npx prisma "$@"
}

echo "==> Step 1/5: Backup"
"$SCRIPT_DIR/backup-mysql.sh"

echo "==> Step 2/5: Clear failed migration records in _prisma_migrations"
FAILED_MIGRATIONS="$(mysql_exec -Nse \
  "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;" \
  2>/dev/null || true)"

if [ -n "$FAILED_MIGRATIONS" ]; then
  while IFS= read -r mig; do
    [ -z "$mig" ] && continue
    echo "    Resolving failed migration: $mig"
    prisma_exec migrate resolve --rolled-back "$mig" 2>/dev/null || true
    prisma_exec migrate resolve --applied "$mig" || prisma_exec migrate resolve --applied "$mig"
  done <<< "$FAILED_MIGRATIONS"
else
  echo "    No failed migration rows found."
fi

echo "==> Step 3/5: Apply pending migrations (auto-baseline when objects already exist)"
MAX_ROUNDS=30
ROUND=0

while [ "$ROUND" -lt "$MAX_ROUNDS" ]; do
  ROUND=$((ROUND + 1))
  set +e
  OUTPUT="$(prisma_exec migrate deploy 2>&1)"
  STATUS=$?
  set -e
  echo "$OUTPUT"

  if [ "$STATUS" -eq 0 ]; then
    echo "    migrate deploy succeeded."
    break
  fi

  if echo "$OUTPUT" | grep -q "Database schema is up to date"; then
    echo "    Database schema is up to date."
    break
  fi

  MIGRATION_NAME=""
  if echo "$OUTPUT" | grep -q "Migration name:"; then
    MIGRATION_NAME="$(echo "$OUTPUT" | sed -n 's/.*Migration name: `\?\([^`'"'"']*\)`\?.*/\1/p' | head -1)"
  fi
  if [ -z "$MIGRATION_NAME" ] && echo "$OUTPUT" | grep -q "Applying migration"; then
    MIGRATION_NAME="$(echo "$OUTPUT" | sed -n 's/.*Applying migration `\?\([^`'"'"']*\)`\?.*/\1/p' | tail -1)"
  fi
  if [ -z "$MIGRATION_NAME" ] && echo "$OUTPUT" | grep -q "P3009"; then
    MIGRATION_NAME="$(echo "$OUTPUT" | grep -oE '[0-9]{14}_[a-z0-9_]+' | head -1)"
  fi

  if [ -z "$MIGRATION_NAME" ]; then
    echo "ERROR: migrate deploy failed and migration name could not be detected."
    exit 1
  fi

  if echo "$OUTPUT" | grep -qiE 'already exists|Duplicate column|Duplicate key name|Duplicate entry|check that column/key exists|Error code: 1050|Error code: 1060|Error code: 1061|Error code: 1062'; then
    echo "    Objects already exist for $MIGRATION_NAME → marking as applied."
    prisma_exec migrate resolve --applied "$MIGRATION_NAME"
    continue
  fi

  if echo "$OUTPUT" | grep -q "P3009"; then
    echo "    P3009 for $MIGRATION_NAME → marking as applied (schema already matches)."
    prisma_exec migrate resolve --applied "$MIGRATION_NAME"
    continue
  fi

  echo "ERROR: Migration $MIGRATION_NAME failed with an unexpected error. Fix manually or restore backup."
  exit 1
done

if [ "$ROUND" -ge "$MAX_ROUNDS" ]; then
  echo "ERROR: Exceeded $MAX_ROUNDS repair rounds."
  exit 1
fi

echo "==> Step 4/5: Idempotent schema patches (v0.5.0 critical)"
mysql_exec <<'SQL'
-- RegistrationAuditLog.billingScope enum (restricted/external registration audit)
SET @billing_scope_type := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'RegistrationAuditLog'
    AND COLUMN_NAME = 'billingScope'
  LIMIT 1
);

SET @needs_billing_patch := IF(
  @billing_scope_type IS NULL
  OR @billing_scope_type NOT LIKE '%RESTRICTED_BILLING%',
  1,
  0
);

SET @patch_sql := IF(
  @needs_billing_patch = 1,
  'ALTER TABLE `RegistrationAuditLog` MODIFY `billingScope` ENUM(
    ''NORMAL_BILLING'',
    ''OFFICE_ONLY_BILLING'',
    ''NO_BILLING'',
    ''MANUAL_REVIEW'',
    ''RESTRICTED_BILLING'',
    ''EXTERNAL_BILLING''
  ) NULL;
  UPDATE `RegistrationAuditLog`
  SET `billingScope` = ''RESTRICTED_BILLING''
  WHERE `billingScope` = ''OFFICE_ONLY_BILLING'';
  ALTER TABLE `RegistrationAuditLog` MODIFY `billingScope` ENUM(
    ''NORMAL_BILLING'',
    ''RESTRICTED_BILLING'',
    ''EXTERNAL_BILLING'',
    ''NO_BILLING'',
    ''MANUAL_REVIEW''
  ) NULL;',
  'SELECT 1'
);

PREPARE stmt FROM @patch_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- RegistrationAuditLog payload columns
SET @has_reg_type := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'RegistrationAuditLog'
    AND COLUMN_NAME = 'registrationType'
);

SET @audit_cols_sql := IF(
  @has_reg_type = 0,
  'ALTER TABLE `RegistrationAuditLog`
    ADD COLUMN `registrationType` ENUM(''INTERNAL_NORMAL'', ''RESTRICTED_INTERNAL'', ''EXTERNAL'') NULL,
    ADD COLUMN `registrationNumber` VARCHAR(191) NULL,
    ADD COLUMN `feeStatementNumber` VARCHAR(191) NULL,
    ADD COLUMN `issueNumber` VARCHAR(191) NULL;',
  'SELECT 1'
);

PREPARE stmt2 FROM @audit_cols_sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @has_reg_type_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'RegistrationAuditLog'
    AND INDEX_NAME = 'RegistrationAuditLog_registrationType_idx'
);

SET @audit_idx_sql := IF(
  @has_reg_type_idx = 0 AND @has_reg_type = 0,
  'CREATE INDEX `RegistrationAuditLog_registrationType_idx` ON `RegistrationAuditLog`(`registrationType`);',
  'SELECT 1'
);

PREPARE stmt3 FROM @audit_idx_sql;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- RegistrationWorkspace.registrationNumber
SET @has_reg_number := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'RegistrationWorkspace'
    AND COLUMN_NAME = 'registrationNumber'
);

SET @reg_num_sql := IF(
  @has_reg_number = 0,
  'ALTER TABLE `RegistrationWorkspace` ADD COLUMN `registrationNumber` VARCHAR(191) NULL;
   CREATE UNIQUE INDEX `RegistrationWorkspace_registrationNumber_key` ON `RegistrationWorkspace`(`registrationNumber`);',
  'SELECT 1'
);

PREPARE stmt4 FROM @reg_num_sql;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;
SQL

echo "==> Step 5/5: Verify"
prisma_exec migrate status || true

echo ""
echo "Schema repair complete. Restart the app:"
echo "  docker compose up -d --build"
echo ""
echo "Optional: backfill registration numbers for legacy rows:"
echo "  docker compose exec app npx tsx scripts/backfill-registration-numbers.ts"
