-- Manual refund ledger. Does not change FeeStatement status or paymentSettlement.

ALTER TABLE `FeeStatementEvent`
  MODIFY COLUMN `kind` ENUM(
    'GENERATED',
    'ISSUED',
    'COVERED',
    'ORDER_CREATED',
    'ORDER_CANCELLED',
    'ORDER_CLOSED',
    'PAID_ONLINE',
    'MARKED_PAID_OFFLINE',
    'NEEDS_REGENERATION',
    'REGENERATED',
    'REPRICED',
    'SUPERSEDED',
    'REFUND_RECORDED'
  ) NOT NULL;

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
    'OFFLINE_WITHDRAWAL_REFUND_COMPLETED',
    'FEE_STATEMENT_MARKED_PAID_OFFLINE',
    'FEE_STATEMENT_REPRICED_BY_CURRENT_STAGE',
    'FEE_REFUND_RECORDED'
  ) NOT NULL;

CREATE TABLE `FeeRefund` (
  `id` VARCHAR(191) NOT NULL,
  `feeStatementId` VARCHAR(191) NOT NULL,
  `registrationWorkspaceId` VARCHAR(191) NOT NULL,
  `registrationWindowId` VARCHAR(191) NULL,
  `method` ENUM('ORIGINAL_CHANNEL', 'OFFLINE') NOT NULL,
  `paymentOrderId` VARCHAR(191) NULL,
  `amountGbp` DECIMAL(12, 2) NOT NULL,
  `refundedAt` DATETIME(3) NOT NULL,
  `externalReference` VARCHAR(191) NOT NULL,
  `reason` ENUM('WITHDRAWAL', 'OVERPAYMENT', 'OTHER') NOT NULL,
  `note` TEXT NULL,
  `recordedByUserId` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `FeeRefund_feeStatementId_idx`(`feeStatementId`),
  INDEX `FeeRefund_registrationWorkspaceId_idx`(`registrationWorkspaceId`),
  INDEX `FeeRefund_registrationWindowId_idx`(`registrationWindowId`),
  INDEX `FeeRefund_paymentOrderId_idx`(`paymentOrderId`),
  INDEX `FeeRefund_recordedByUserId_idx`(`recordedByUserId`),
  INDEX `FeeRefund_recordedAt_idx`(`recordedAt`),
  CONSTRAINT `FeeRefund_feeStatementId_fkey`
    FOREIGN KEY (`feeStatementId`) REFERENCES `FeeStatement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FeeRefund_registrationWorkspaceId_fkey`
    FOREIGN KEY (`registrationWorkspaceId`) REFERENCES `RegistrationWorkspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FeeRefund_registrationWindowId_fkey`
    FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `FeeRefund_recordedByUserId_fkey`
    FOREIGN KEY (`recordedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FeeRefundAllocation` (
  `id` VARCHAR(191) NOT NULL,
  `feeRefundId` VARCHAR(191) NOT NULL,
  `offlineWithdrawalRefundId` VARCHAR(191) NOT NULL,
  `amountGbp` DECIMAL(12, 2) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `FeeRefundAllocation_feeRefundId_idx`(`feeRefundId`),
  INDEX `FeeRefundAllocation_offlineWithdrawalRefundId_idx`(`offlineWithdrawalRefundId`),
  CONSTRAINT `FeeRefundAllocation_feeRefundId_fkey`
    FOREIGN KEY (`feeRefundId`) REFERENCES `FeeRefund`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FeeRefundAllocation_offlineWithdrawalRefundId_fkey`
    FOREIGN KEY (`offlineWithdrawalRefundId`) REFERENCES `OfflineWithdrawalRefund`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
