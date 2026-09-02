-- Cash-in requests become a global EO workspace (no required review window),
-- with locked cash-in code + fee quote snapshots for later billing.

-- Legacy scaffold rows cannot satisfy the new required fields.
DELETE FROM `CashInRequest`;

ALTER TABLE `CashInRequest` DROP FOREIGN KEY `CashInRequest_reviewWindowId_fkey`;
ALTER TABLE `CashInRequest` DROP FOREIGN KEY `CashInRequest_qualificationId_fkey`;
ALTER TABLE `CashInRequest` DROP FOREIGN KEY `CashInRequest_subjectId_fkey`;

ALTER TABLE `CashInRequest`
  MODIFY `reviewWindowId` VARCHAR(191) NULL,
  MODIFY `qualificationId` VARCHAR(191) NOT NULL,
  MODIFY `subjectId` VARCHAR(191) NOT NULL,
  ADD COLUMN `cashInCode` VARCHAR(191) NOT NULL,
  ADD COLUMN `feeScheduleId` VARCHAR(191) NULL,
  ADD COLUMN `quoteMatchLevel` VARCHAR(191) NULL,
  ADD COLUMN `quotedCostCurrency` ENUM('GBP', 'CNY') NULL,
  ADD COLUMN `quotedCostAmount` DECIMAL(12, 2) NULL,
  ADD COLUMN `quotedSalesCurrency` ENUM('GBP', 'CNY') NULL,
  ADD COLUMN `quotedSalesAmount` DECIMAL(12, 2) NULL;

ALTER TABLE `CashInRequest`
  ADD CONSTRAINT `CashInRequest_reviewWindowId_fkey`
    FOREIGN KEY (`reviewWindowId`) REFERENCES `ReviewWindow`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `CashInRequest_qualificationId_fkey`
    FOREIGN KEY (`qualificationId`) REFERENCES `Qualification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CashInRequest_subjectId_fkey`
    FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CashInRequest_feeScheduleId_fkey`
    FOREIGN KEY (`feeScheduleId`) REFERENCES `FeeSchedule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `CashInRequest_examSeriesId_idx` ON `CashInRequest`(`examSeriesId`);
CREATE INDEX `CashInRequest_qualificationId_idx` ON `CashInRequest`(`qualificationId`);
CREATE INDEX `CashInRequest_subjectId_idx` ON `CashInRequest`(`subjectId`);
CREATE INDEX `CashInRequest_cashInCode_idx` ON `CashInRequest`(`cashInCode`);
CREATE INDEX `CashInRequest_feeScheduleId_idx` ON `CashInRequest`(`feeScheduleId`);

ALTER TABLE `PostResultsAuditLog`
  MODIFY `action` ENUM(
    'REVIEW_WINDOW_CREATED',
    'REVIEW_WINDOW_UPDATED',
    'REVIEW_WINDOW_LOCKED',
    'REVIEW_SERVICE_ENABLED',
    'REVIEW_SERVICE_DISABLED',
    'REVIEW_REQUEST_CREATED',
    'REVIEW_REQUEST_UPDATED',
    'REVIEW_REQUEST_SUBMITTED',
    'CASH_IN_REQUEST_CREATED',
    'CASH_IN_REQUEST_UPDATED',
    'ACCESS_TO_SCRIPT_REQUEST_CREATED',
    'CERTIFICATE_REQUEST_CREATED',
    'FEE_SCHEDULE_VERSION_CREATED',
    'REGISTRATION_FEE_STATEMENT_GENERATED',
    'POST_RESULTS_FEE_STATEMENT_GENERATED'
  ) NOT NULL;
