import path from "node:path";
import {
  ALLOWED_BACKUP_DIRECTORY_PREFIXES,
  DEFAULT_BACKUP_DIRECTORY,
  DEV_BACKUP_DIRECTORY_NAME,
} from "@/lib/backup/constants";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidBackupTime(value: string): boolean {
  return TIME_PATTERN.test(value.trim());
}

export function resolveProjectRoot(): string {
  return process.cwd();
}

export function getDevBackupDirectory(): string {
  return path.resolve(resolveProjectRoot(), DEV_BACKUP_DIRECTORY_NAME);
}

export function isAllowedBackupDirectory(input: string): boolean {
  const normalized = path.resolve(input.trim());
  if (ALLOWED_BACKUP_DIRECTORY_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  if (process.env.NODE_ENV === "development") {
    const devDir = getDevBackupDirectory();
    return normalized === devDir || normalized.startsWith(`${devDir}${path.sep}`);
  }
  return false;
}

export function normalizeBackupDirectory(input: string): string {
  const trimmed = input.trim() || DEFAULT_BACKUP_DIRECTORY;
  const resolved = path.resolve(trimmed);
  if (!isAllowedBackupDirectory(resolved)) {
    throw new Error(
      "Backup directory must be under /var/backups/ (or backups/mysql in development).",
    );
  }
  return resolved;
}

export function buildBackupFileName(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `xima_assessment_hub_backup_${yyyy}${mm}${dd}_${hh}${min}${ss}.sql.gz`;
}

export function isPathInsideDirectory(filePath: string, directory: string): boolean {
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(directory);
  return resolvedFile === resolvedDir || resolvedFile.startsWith(`${resolvedDir}${path.sep}`);
}

export function sanitizeBackupFileName(fileName: string): string {
  const base = path.basename(fileName);
  if (!/^xima_assessment_hub_backup_\d{8}_\d{6}\.sql\.gz$/.test(base)) {
    throw new Error("Invalid backup file name");
  }
  return base;
}
