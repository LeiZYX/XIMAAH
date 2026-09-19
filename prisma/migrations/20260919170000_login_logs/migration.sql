-- Login success, failure, and logout. Failures from the same IP and login name collapse within one minute.

CREATE TABLE `LoginLog` (
  `id` VARCHAR(191) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `result` ENUM('SUCCESS', 'FAILED', 'LOGOUT') NOT NULL,
  `failureReason` ENUM('INVALID_CREDENTIALS', 'INACTIVE') NULL,
  `attemptCount` INTEGER NOT NULL DEFAULT 1,
  `userId` VARCHAR(191) NULL,
  `nameSnapshot` VARCHAR(191) NULL,
  `roleSnapshot` ENUM('ADMIN', 'EXAM_OFFICER', 'SUBJECT_TEACHER', 'STUDENT') NULL,
  `identifier` VARCHAR(191) NOT NULL,
  `ipAddress` VARCHAR(64) NOT NULL,
  `userAgent` VARCHAR(200) NULL,
  PRIMARY KEY (`id`),
  INDEX `LoginLog_lastAttemptAt_idx`(`lastAttemptAt`),
  INDEX `LoginLog_result_occurredAt_idx`(`result`, `occurredAt`),
  INDEX `LoginLog_userId_idx`(`userId`),
  INDEX `LoginLog_ipAddress_identifier_result_lastAttemptAt_idx`(`ipAddress`, `identifier`, `result`, `lastAttemptAt`),
  CONSTRAINT `LoginLog_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
