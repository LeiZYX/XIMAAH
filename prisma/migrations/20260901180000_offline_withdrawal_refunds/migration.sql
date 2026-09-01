-- Phase 2: offline withdrawal refund ledger (finance refunds outside GlobePay)

ALTER TABLE `FeeAuditLog`
  MODIFY COLUMN `action` ENUM(
    'FEE_RULE_CREATED',
    'FEE_RULE_UPDATED',
    'EXCHANGE_RATE_UPDATED',
    'FEE_STATEMENT_GENERATED',
    'FEE_STATEMENT_BATCH_GENERATED',
    'FEE_STATEMENT_PRINTED',
    'FEE_SUMMARY_EXPORTED',
    'FEE_DETAILS_EXPORTED',
    'FEE_SCHEDULE_VERSION_CREATED',
    'REGISTRATION_FEE_STATEMENT_GENERATED',
    'POST_RESULTS_FEE_STATEMENT_GENERATED',
    'FEE_STATEMENT_MARKED_NEEDS_REGENERATION',
    'FEE_STATEMENT_REGENERATED_REVISED',
    'FEE_STATEMENT_ISSUED',
    'EXAM_ADDED',
    'EXAM_REMOVED',
    'EXAM_REPLACED',
    'CANDIDATE_REGISTRATION_FEE_ADDED',
    'CANDIDATE_REGISTRATION_FEE_REMOVED',
    'ADDITIONAL_SERVICE_ADDED',
    'ADDITIONAL_SERVICE_REMOVED',
    'OFFLINE_WITHDRAWAL_REFUND_RECORDED',
    'OFFLINE_WITHDRAWAL_REFUND_COMPLETED'
  ) NOT NULL;

CREATE TABLE `OfflineWithdrawalRefund` (
  `id` VARCHAR(191) NOT NULL,
  `registrationWorkspaceId` VARCHAR(191) NOT NULL,
  `registrationWindowId` VARCHAR(191) NOT NULL,
  `candidateId` VARCHAR(191) NULL,
  `studentId` VARCHAR(191) NULL,
  `registrationId` VARCHAR(191) NULL,
  `examSessionId` VARCHAR(191) NOT NULL,
  `paperCodeSnapshot` VARCHAR(191) NOT NULL,
  `subjectSnapshot` VARCHAR(191) NOT NULL,
  `feeStageCode` ENUM('NORMAL', 'LATE', 'HIGH_LATE') NOT NULL,
  `salesAmountGbp` DECIMAL(12, 2) NOT NULL,
  `salesAmountCny` DECIMAL(12, 2) NULL,
  `configuredRefundPercent` DECIMAL(5, 2) NOT NULL,
  `paymentFeePercent` DECIMAL(5, 2) NOT NULL,
  `effectiveRefundPercent` DECIMAL(5, 2) NOT NULL,
  `creditGbp` DECIMAL(12, 2) NOT NULL,
  `creditCny` DECIMAL(12, 2) NULL,
  `status` ENUM('PENDING_OFFLINE', 'COMPLETED', 'ZERO_NO_REFUND') NOT NULL DEFAULT 'PENDING_OFFLINE',
  `policyNotes` TEXT NULL,
  `calculationNotes` TEXT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `completedByUserId` VARCHAR(191) NULL,
  `offlineReference` VARCHAR(191) NULL,
  `offlineNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `OfflineWithdrawalRefund_registrationWorkspaceId_idx`(`registrationWorkspaceId`),
  INDEX `OfflineWithdrawalRefund_registrationWindowId_idx`(`registrationWindowId`),
  INDEX `OfflineWithdrawalRefund_candidateId_idx`(`candidateId`),
  INDEX `OfflineWithdrawalRefund_examSessionId_idx`(`examSessionId`),
  INDEX `OfflineWithdrawalRefund_status_idx`(`status`),
  INDEX `OfflineWithdrawalRefund_createdByUserId_idx`(`createdByUserId`),
  INDEX `OfflineWithdrawalRefund_completedByUserId_idx`(`completedByUserId`),
  INDEX `OfflineWithdrawalRefund_createdAt_idx`(`createdAt`),

  CONSTRAINT `OfflineWithdrawalRefund_registrationWorkspaceId_fkey`
    FOREIGN KEY (`registrationWorkspaceId`) REFERENCES `RegistrationWorkspace`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OfflineWithdrawalRefund_registrationWindowId_fkey`
    FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OfflineWithdrawalRefund_candidateId_fkey`
    FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `OfflineWithdrawalRefund_examSessionId_fkey`
    FOREIGN KEY (`examSessionId`) REFERENCES `ExamSession`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OfflineWithdrawalRefund_createdByUserId_fkey`
    FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OfflineWithdrawalRefund_completedByUserId_fkey`
    FOREIGN KEY (`completedByUserId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
