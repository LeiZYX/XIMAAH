export const BACKUP_SETTINGS_ID = "default";

export const DEFAULT_BACKUP_DIRECTORY = "/var/backups/xima-assessment-hub";

export const ALLOWED_BACKUP_DIRECTORY_PREFIXES = [
  "/var/backups/",
] as const;

/** Dev-only: project-local backups directory name under repo root */
export const DEV_BACKUP_DIRECTORY_NAME = "backups/mysql";

export const BACKUP_FILENAME_PREFIX = "xima_assessment_hub_backup_";

export const BACKUP_CRON_SECRET_ENV = "BACKUP_CRON_SECRET";
