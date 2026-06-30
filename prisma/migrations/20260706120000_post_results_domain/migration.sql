-- AlterEnum FeeAuditAction
ALTER TABLE `FeeAuditLog` MODIFY `action` ENUM(
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
  'POST_RESULTS_FEE_STATEMENT_GENERATED'
) NOT NULL;

-- AlterTable FeeStatement
ALTER TABLE `FeeStatement`
  ADD COLUMN `businessType` ENUM('REGISTRATION', 'POST_RESULTS') NOT NULL DEFAULT 'REGISTRATION',
  ADD COLUMN `reviewWindowId` VARCHAR(191) NULL,
  MODIFY `registrationWorkspaceId` VARCHAR(191) NULL,
  MODIFY `registrationWindowId` VARCHAR(191) NULL;

CREATE INDEX `FeeStatement_reviewWindowId_idx` ON `FeeStatement`(`reviewWindowId`);
CREATE INDEX `FeeStatement_businessType_idx` ON `FeeStatement`(`businessType`);

-- AlterTable FeeStatementItem
ALTER TABLE `FeeStatementItem`
  ADD COLUMN `serviceType` ENUM(
    'CANDIDATE_REGISTRATION',
    'EXAM_ENTRY',
    'REVIEW',
    'PRIORITY_REVIEW',
    'CLERICAL_CHECK',
    'ACCESS_TO_SCRIPT',
    'CASH_IN',
    'CERTIFICATE',
    'ADMINISTRATIVE'
  ) NULL,
  ADD COLUMN `feeScheduleId` VARCHAR(191) NULL,
  ADD COLUMN `feeScheduleVersionSnapshot` INTEGER NULL,
  ADD COLUMN `serviceNameSnapshot` VARCHAR(191) NULL,
  ADD COLUMN `salesCurrencySnapshot` ENUM('GBP', 'CNY') NULL,
  ADD COLUMN `salesAmountSnapshot` DECIMAL(12, 2) NULL,
  MODIFY `qualificationSnapshot` VARCHAR(191) NULL,
  MODIFY `subjectSnapshot` VARCHAR(191) NULL,
  MODIFY `paperCodeSnapshot` VARCHAR(191) NULL,
  MODIFY `paperTitleSnapshot` VARCHAR(191) NULL,
  MODIFY `entryTypeSnapshot` ENUM('NORMAL', 'LATE', 'HIGH_LATE') NULL,
  MODIFY `markupTypeSnapshot` ENUM('PERCENTAGE', 'FIXED_AMOUNT') NULL,
  MODIFY `salesGbpAmountSnapshot` DECIMAL(12, 2) NULL,
  MODIFY `salesCnyAmountSnapshot` DECIMAL(12, 2) NULL;

CREATE INDEX `FeeStatementItem_feeScheduleId_idx` ON `FeeStatementItem`(`feeScheduleId`);
CREATE INDEX `FeeStatementItem_serviceType_idx` ON `FeeStatementItem`(`serviceType`);

-- CreateTable ReviewWindow
CREATE TABLE `ReviewWindow` (
  `id` VARCHAR(191) NOT NULL,
  `examBoardId` VARCHAR(191) NOT NULL,
  `examSeriesId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `resultsReleaseDate` DATETIME(3) NULL,
  `openAt` DATETIME(3) NOT NULL,
  `closeAt` DATETIME(3) NOT NULL,
  `status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'LOCKED') NOT NULL DEFAULT 'DRAFT',
  `notes` TEXT NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ReviewWindow_examBoardId_idx`(`examBoardId`),
  INDEX `ReviewWindow_examSeriesId_idx`(`examSeriesId`),
  INDEX `ReviewWindow_status_idx`(`status`),
  INDEX `ReviewWindow_openAt_closeAt_idx`(`openAt`, `closeAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable ReviewWindowService
CREATE TABLE `ReviewWindowService` (
  `id` VARCHAR(191) NOT NULL,
  `reviewWindowId` VARCHAR(191) NOT NULL,
  `serviceType` ENUM(
    'REVIEW',
    'PRIORITY_REVIEW',
    'CLERICAL_CHECK',
    'ACCESS_TO_SCRIPT',
    'CASH_IN',
    'CERTIFICATE',
    'ADMINISTRATIVE'
  ) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ReviewWindowService_reviewWindowId_serviceType_key`(`reviewWindowId`, `serviceType`),
  INDEX `ReviewWindowService_reviewWindowId_idx`(`reviewWindowId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable ReviewRequest
CREATE TABLE `ReviewRequest` (
  `id` VARCHAR(191) NOT NULL,
  `reviewWindowId` VARCHAR(191) NOT NULL,
  `candidateId` VARCHAR(191) NOT NULL,
  `examBoardId` VARCHAR(191) NOT NULL,
  `examSeriesId` VARCHAR(191) NOT NULL,
  `registrationItemId` VARCHAR(191) NULL,
  `examSessionId` VARCHAR(191) NULL,
  `subjectId` VARCHAR(191) NULL,
  `paperId` VARCHAR(191) NULL,
  `serviceType` ENUM(
    'REVIEW',
    'PRIORITY_REVIEW',
    'CLERICAL_CHECK',
    'ACCESS_TO_SCRIPT',
    'CASH_IN',
    'CERTIFICATE',
    'ADMINISTRATIVE'
  ) NOT NULL,
  `reviewType` VARCHAR(191) NULL,
  `priority` BOOLEAN NOT NULL DEFAULT false,
  `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'SENT_TO_BOARD', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `requestedByUserId` VARCHAR(191) NOT NULL,
  `reviewedByUserId` VARCHAR(191) NULL,
  `resultOutcome` VARCHAR(191) NULL,
  `reason` TEXT NULL,
  `notes` TEXT NULL,
  `feeStatementId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ReviewRequest_reviewWindowId_idx`(`reviewWindowId`),
  INDEX `ReviewRequest_candidateId_idx`(`candidateId`),
  INDEX `ReviewRequest_examBoardId_idx`(`examBoardId`),
  INDEX `ReviewRequest_examSeriesId_idx`(`examSeriesId`),
  INDEX `ReviewRequest_serviceType_idx`(`serviceType`),
  INDEX `ReviewRequest_status_idx`(`status`),
  INDEX `ReviewRequest_registrationItemId_idx`(`registrationItemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable CashInRequest
CREATE TABLE `CashInRequest` (
  `id` VARCHAR(191) NOT NULL,
  `reviewWindowId` VARCHAR(191) NOT NULL,
  `candidateId` VARCHAR(191) NOT NULL,
  `examBoardId` VARCHAR(191) NOT NULL,
  `examSeriesId` VARCHAR(191) NOT NULL,
  `qualificationId` VARCHAR(191) NULL,
  `subjectId` VARCHAR(191) NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'SENT_TO_BOARD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `requestedByUserId` VARCHAR(191) NOT NULL,
  `reason` TEXT NULL,
  `notes` TEXT NULL,
  `feeStatementId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `CashInRequest_reviewWindowId_idx`(`reviewWindowId`),
  INDEX `CashInRequest_candidateId_idx`(`candidateId`),
  INDEX `CashInRequest_examBoardId_idx`(`examBoardId`),
  INDEX `CashInRequest_status_idx`(`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable AccessToScriptRequest
CREATE TABLE `AccessToScriptRequest` (
  `id` VARCHAR(191) NOT NULL,
  `reviewWindowId` VARCHAR(191) NOT NULL,
  `candidateId` VARCHAR(191) NOT NULL,
  `examBoardId` VARCHAR(191) NOT NULL,
  `examSeriesId` VARCHAR(191) NOT NULL,
  `registrationItemId` VARCHAR(191) NULL,
  `examSessionId` VARCHAR(191) NULL,
  `subjectId` VARCHAR(191) NULL,
  `paperId` VARCHAR(191) NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'SENT_TO_BOARD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `requestedByUserId` VARCHAR(191) NOT NULL,
  `notes` TEXT NULL,
  `feeStatementId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `AccessToScriptRequest_reviewWindowId_idx`(`reviewWindowId`),
  INDEX `AccessToScriptRequest_candidateId_idx`(`candidateId`),
  INDEX `AccessToScriptRequest_examBoardId_idx`(`examBoardId`),
  INDEX `AccessToScriptRequest_status_idx`(`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable CertificateRequest
CREATE TABLE `CertificateRequest` (
  `id` VARCHAR(191) NOT NULL,
  `reviewWindowId` VARCHAR(191) NULL,
  `candidateId` VARCHAR(191) NOT NULL,
  `examBoardId` VARCHAR(191) NOT NULL,
  `examSeriesId` VARCHAR(191) NULL,
  `requestType` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'SENT_TO_BOARD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `requestedByUserId` VARCHAR(191) NOT NULL,
  `notes` TEXT NULL,
  `feeStatementId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `CertificateRequest_reviewWindowId_idx`(`reviewWindowId`),
  INDEX `CertificateRequest_candidateId_idx`(`candidateId`),
  INDEX `CertificateRequest_examBoardId_idx`(`examBoardId`),
  INDEX `CertificateRequest_status_idx`(`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable CandidateBoardRegistration
CREATE TABLE `CandidateBoardRegistration` (
  `id` VARCHAR(191) NOT NULL,
  `candidateId` VARCHAR(191) NOT NULL,
  `examBoardId` VARCHAR(191) NOT NULL,
  `registered` BOOLEAN NOT NULL DEFAULT false,
  `registrationFeePaid` BOOLEAN NOT NULL DEFAULT false,
  `registrationFeePaidAt` DATETIME(3) NULL,
  `feeStatementId` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CandidateBoardRegistration_candidateId_examBoardId_key`(`candidateId`, `examBoardId`),
  INDEX `CandidateBoardRegistration_examBoardId_idx`(`examBoardId`),
  INDEX `CandidateBoardRegistration_registrationFeePaid_idx`(`registrationFeePaid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable FeeSchedule
CREATE TABLE `FeeSchedule` (
  `id` VARCHAR(191) NOT NULL,
  `examBoardId` VARCHAR(191) NOT NULL,
  `serviceType` ENUM(
    'CANDIDATE_REGISTRATION',
    'EXAM_ENTRY',
    'REVIEW',
    'PRIORITY_REVIEW',
    'CLERICAL_CHECK',
    'ACCESS_TO_SCRIPT',
    'CASH_IN',
    'CERTIFICATE',
    'ADMINISTRATIVE'
  ) NOT NULL,
  `qualificationId` VARCHAR(191) NULL,
  `subjectId` VARCHAR(191) NULL,
  `paperId` VARCHAR(191) NULL,
  `entryType` ENUM('NORMAL', 'LATE', 'HIGH_LATE') NULL,
  `reviewType` VARCHAR(191) NULL,
  `version` INTEGER NOT NULL,
  `effectiveFrom` DATETIME(3) NOT NULL,
  `effectiveTo` DATETIME(3) NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `costCurrency` ENUM('GBP', 'CNY') NOT NULL,
  `costAmount` DECIMAL(12, 2) NOT NULL,
  `salesCurrency` ENUM('GBP', 'CNY') NOT NULL,
  `salesAmount` DECIMAL(12, 2) NOT NULL,
  `markupType` ENUM('PERCENTAGE', 'FIXED_AMOUNT') NULL,
  `markupValue` DECIMAL(12, 2) NULL,
  `exchangeRateToCny` DECIMAL(12, 4) NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `FeeSchedule_examBoardId_idx`(`examBoardId`),
  INDEX `FeeSchedule_serviceType_idx`(`serviceType`),
  INDEX `FeeSchedule_status_idx`(`status`),
  INDEX `FeeSchedule_effectiveFrom_effectiveTo_idx`(`effectiveFrom`, `effectiveTo`),
  INDEX `FeeSchedule_version_idx`(`version`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable PostResultsAuditLog
CREATE TABLE `PostResultsAuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `action` ENUM(
    'REVIEW_WINDOW_CREATED',
    'REVIEW_WINDOW_UPDATED',
    'REVIEW_WINDOW_LOCKED',
    'REVIEW_SERVICE_ENABLED',
    'REVIEW_SERVICE_DISABLED',
    'REVIEW_REQUEST_CREATED',
    'REVIEW_REQUEST_UPDATED',
    'REVIEW_REQUEST_SUBMITTED',
    'CASH_IN_REQUEST_CREATED',
    'ACCESS_TO_SCRIPT_REQUEST_CREATED',
    'CERTIFICATE_REQUEST_CREATED',
    'FEE_SCHEDULE_VERSION_CREATED',
    'REGISTRATION_FEE_STATEMENT_GENERATED',
    'POST_RESULTS_FEE_STATEMENT_GENERATED'
  ) NOT NULL,
  `candidateId` VARCHAR(191) NULL,
  `examBoardId` VARCHAR(191) NULL,
  `examSeriesId` VARCHAR(191) NULL,
  `registrationWindowId` VARCHAR(191) NULL,
  `reviewWindowId` VARCHAR(191) NULL,
  `serviceType` ENUM(
    'CANDIDATE_REGISTRATION',
    'EXAM_ENTRY',
    'REVIEW',
    'PRIORITY_REVIEW',
    'CLERICAL_CHECK',
    'ACCESS_TO_SCRIPT',
    'CASH_IN',
    'CERTIFICATE',
    'ADMINISTRATIVE'
  ) NULL,
  `performedByUserId` VARCHAR(191) NOT NULL,
  `performedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reason` TEXT NULL,
  `notes` TEXT NULL,
  `metadata` TEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `PostResultsAuditLog_reviewWindowId_idx`(`reviewWindowId`),
  INDEX `PostResultsAuditLog_registrationWindowId_idx`(`registrationWindowId`),
  INDEX `PostResultsAuditLog_candidateId_idx`(`candidateId`),
  INDEX `PostResultsAuditLog_examBoardId_idx`(`examBoardId`),
  INDEX `PostResultsAuditLog_action_idx`(`action`),
  INDEX `PostResultsAuditLog_performedAt_idx`(`performedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKeys
ALTER TABLE `FeeStatement` ADD CONSTRAINT `FeeStatement_reviewWindowId_fkey` FOREIGN KEY (`reviewWindowId`) REFERENCES `ReviewWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FeeStatementItem` ADD CONSTRAINT `FeeStatementItem_feeScheduleId_fkey` FOREIGN KEY (`feeScheduleId`) REFERENCES `FeeSchedule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReviewWindow` ADD CONSTRAINT `ReviewWindow_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReviewWindow` ADD CONSTRAINT `ReviewWindow_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReviewWindow` ADD CONSTRAINT `ReviewWindow_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReviewWindowService` ADD CONSTRAINT `ReviewWindowService_reviewWindowId_fkey` FOREIGN KEY (`reviewWindowId`) REFERENCES `ReviewWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_reviewWindowId_fkey` FOREIGN KEY (`reviewWindowId`) REFERENCES `ReviewWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_registrationItemId_fkey` FOREIGN KEY (`registrationItemId`) REFERENCES `StudentExamRegistration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_examSessionId_fkey` FOREIGN KEY (`examSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_feeStatementId_fkey` FOREIGN KEY (`feeStatementId`) REFERENCES `FeeStatement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CashInRequest` ADD CONSTRAINT `CashInRequest_reviewWindowId_fkey` FOREIGN KEY (`reviewWindowId`) REFERENCES `ReviewWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CashInRequest` ADD CONSTRAINT `CashInRequest_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CashInRequest` ADD CONSTRAINT `CashInRequest_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CashInRequest` ADD CONSTRAINT `CashInRequest_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CashInRequest` ADD CONSTRAINT `CashInRequest_qualificationId_fkey` FOREIGN KEY (`qualificationId`) REFERENCES `Qualification`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CashInRequest` ADD CONSTRAINT `CashInRequest_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CashInRequest` ADD CONSTRAINT `CashInRequest_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CashInRequest` ADD CONSTRAINT `CashInRequest_feeStatementId_fkey` FOREIGN KEY (`feeStatementId`) REFERENCES `FeeStatement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AccessToScriptRequest` ADD CONSTRAINT `AccessToScriptRequest_reviewWindowId_fkey` FOREIGN KEY (`reviewWindowId`) REFERENCES `ReviewWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AccessToScriptRequest` ADD CONSTRAINT `AccessToScriptRequest_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AccessToScriptRequest` ADD CONSTRAINT `AccessToScriptRequest_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AccessToScriptRequest` ADD CONSTRAINT `AccessToScriptRequest_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AccessToScriptRequest` ADD CONSTRAINT `AccessToScriptRequest_registrationItemId_fkey` FOREIGN KEY (`registrationItemId`) REFERENCES `StudentExamRegistration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AccessToScriptRequest` ADD CONSTRAINT `AccessToScriptRequest_examSessionId_fkey` FOREIGN KEY (`examSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AccessToScriptRequest` ADD CONSTRAINT `AccessToScriptRequest_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AccessToScriptRequest` ADD CONSTRAINT `AccessToScriptRequest_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AccessToScriptRequest` ADD CONSTRAINT `AccessToScriptRequest_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AccessToScriptRequest` ADD CONSTRAINT `AccessToScriptRequest_feeStatementId_fkey` FOREIGN KEY (`feeStatementId`) REFERENCES `FeeStatement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CertificateRequest` ADD CONSTRAINT `CertificateRequest_reviewWindowId_fkey` FOREIGN KEY (`reviewWindowId`) REFERENCES `ReviewWindow`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CertificateRequest` ADD CONSTRAINT `CertificateRequest_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CertificateRequest` ADD CONSTRAINT `CertificateRequest_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CertificateRequest` ADD CONSTRAINT `CertificateRequest_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CertificateRequest` ADD CONSTRAINT `CertificateRequest_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CertificateRequest` ADD CONSTRAINT `CertificateRequest_feeStatementId_fkey` FOREIGN KEY (`feeStatementId`) REFERENCES `FeeStatement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CandidateBoardRegistration` ADD CONSTRAINT `CandidateBoardRegistration_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CandidateBoardRegistration` ADD CONSTRAINT `CandidateBoardRegistration_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CandidateBoardRegistration` ADD CONSTRAINT `CandidateBoardRegistration_feeStatementId_fkey` FOREIGN KEY (`feeStatementId`) REFERENCES `FeeStatement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FeeSchedule` ADD CONSTRAINT `FeeSchedule_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FeeSchedule` ADD CONSTRAINT `FeeSchedule_qualificationId_fkey` FOREIGN KEY (`qualificationId`) REFERENCES `Qualification`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FeeSchedule` ADD CONSTRAINT `FeeSchedule_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FeeSchedule` ADD CONSTRAINT `FeeSchedule_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FeeSchedule` ADD CONSTRAINT `FeeSchedule_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PostResultsAuditLog` ADD CONSTRAINT `PostResultsAuditLog_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PostResultsAuditLog` ADD CONSTRAINT `PostResultsAuditLog_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PostResultsAuditLog` ADD CONSTRAINT `PostResultsAuditLog_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PostResultsAuditLog` ADD CONSTRAINT `PostResultsAuditLog_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PostResultsAuditLog` ADD CONSTRAINT `PostResultsAuditLog_reviewWindowId_fkey` FOREIGN KEY (`reviewWindowId`) REFERENCES `ReviewWindow`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PostResultsAuditLog` ADD CONSTRAINT `PostResultsAuditLog_performedByUserId_fkey` FOREIGN KEY (`performedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
