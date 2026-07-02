-- Backup settings, jobs, and audit actions

CREATE TABLE `BackupSetting` (
  `id` VARCHAR(191) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `frequency` ENUM('DAILY', 'WEEKLY', 'MONTHLY') NOT NULL DEFAULT 'DAILY',
  `backupTime` VARCHAR(191) NOT NULL DEFAULT '02:00',
  `backupDirectory` VARCHAR(191) NOT NULL DEFAULT '/var/backups/xima-assessment-hub',
  `retentionDays` INTEGER NOT NULL DEFAULT 30,
  `backupType` ENUM('DATABASE_ONLY', 'DATABASE_AND_UPLOADS') NOT NULL DEFAULT 'DATABASE_ONLY',
  `updatedByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `BackupSetting` (`id`, `enabled`, `frequency`, `backupTime`, `backupDirectory`, `retentionDays`, `backupType`, `updatedAt`)
VALUES ('default', false, 'DAILY', '02:00', '/var/backups/xima-assessment-hub', 30, 'DATABASE_ONLY', CURRENT_TIMESTAMP(3));

ALTER TABLE `BackupSetting`
  ADD CONSTRAINT `BackupSetting_updatedByUserId_fkey`
  FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `BackupJob` (
  `id` VARCHAR(191) NOT NULL,
  `backupType` ENUM('DATABASE_ONLY', 'DATABASE_AND_UPLOADS') NOT NULL,
  `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `fileName` VARCHAR(191) NULL,
  `filePath` VARCHAR(191) NULL,
  `fileSizeBytes` BIGINT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `errorMessage` TEXT NULL,
  `triggeredBy` ENUM('SCHEDULED', 'MANUAL') NOT NULL,
  `triggeredByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `BackupJob_status_idx`(`status`),
  INDEX `BackupJob_createdAt_idx`(`createdAt`),
  INDEX `BackupJob_triggeredBy_idx`(`triggeredBy`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BackupJob`
  ADD CONSTRAINT `BackupJob_triggeredByUserId_fkey`
  FOREIGN KEY (`triggeredByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `UserAuditLog` MODIFY `action` ENUM(
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_FORCE_SET_BY_ADMIN',
  'STUDENT_IMPORTED',
  'TEACHER_IMPORTED',
  'STUDENT_PROMOTED',
  'STUDENT_ARCHIVED',
  'STUDENT_REACTIVATED',
  'STUDENT_DELETED',
  'BACKUP_SETTINGS_UPDATED',
  'BACKUP_MANUAL_STARTED',
  'BACKUP_MANUAL_SUCCESS',
  'BACKUP_MANUAL_FAILED',
  'BACKUP_FILE_DOWNLOADED',
  'BACKUP_FILE_DELETED'
) NOT NULL;
