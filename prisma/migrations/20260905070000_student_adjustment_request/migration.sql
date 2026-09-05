-- Student late adjustment request (batch ADD/REMOVE) + window flags

ALTER TABLE `RegistrationWindow`
  ADD COLUMN `studentAdjustmentRequestEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `studentAdjustmentRequestCloseAt` DATETIME(3) NULL;

CREATE TABLE `StudentAdjustmentRequest` (
  `id` VARCHAR(191) NOT NULL,
  `registrationWorkspaceId` VARCHAR(191) NOT NULL,
  `registrationWindowId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `candidateId` VARCHAR(191) NULL,
  `status` ENUM('PENDING_TEACHER', 'PENDING_EO', 'APPROVED', 'REJECTED') NOT NULL,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `teacherReviewedByUserId` VARCHAR(191) NULL,
  `teacherReviewedAt` DATETIME(3) NULL,
  `teacherReviewReason` TEXT NULL,
  `eoReviewedByUserId` VARCHAR(191) NULL,
  `eoReviewedAt` DATETIME(3) NULL,
  `eoReviewReason` TEXT NULL,
  `rejectedAtStage` ENUM('TEACHER', 'EO') NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StudentAdjustmentRequestItem` (
  `id` VARCHAR(191) NOT NULL,
  `requestId` VARCHAR(191) NOT NULL,
  `itemType` ENUM('ADD', 'REMOVE') NOT NULL,
  `targetExamSessionId` VARCHAR(191) NULL,
  `targetRegistrationId` VARCHAR(191) NULL,
  `studentReason` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `StudentAdjustmentRequest_registrationWorkspaceId_idx` ON `StudentAdjustmentRequest`(`registrationWorkspaceId`);
CREATE INDEX `StudentAdjustmentRequest_registrationWindowId_idx` ON `StudentAdjustmentRequest`(`registrationWindowId`);
CREATE INDEX `StudentAdjustmentRequest_studentId_idx` ON `StudentAdjustmentRequest`(`studentId`);
CREATE INDEX `StudentAdjustmentRequest_candidateId_idx` ON `StudentAdjustmentRequest`(`candidateId`);
CREATE INDEX `StudentAdjustmentRequest_status_idx` ON `StudentAdjustmentRequest`(`status`);
CREATE INDEX `StudentAdjustmentRequest_submittedAt_idx` ON `StudentAdjustmentRequest`(`submittedAt`);

CREATE INDEX `StudentAdjustmentRequestItem_requestId_idx` ON `StudentAdjustmentRequestItem`(`requestId`);
CREATE INDEX `StudentAdjustmentRequestItem_targetExamSessionId_idx` ON `StudentAdjustmentRequestItem`(`targetExamSessionId`);
CREATE INDEX `StudentAdjustmentRequestItem_targetRegistrationId_idx` ON `StudentAdjustmentRequestItem`(`targetRegistrationId`);
CREATE INDEX `StudentAdjustmentRequestItem_itemType_idx` ON `StudentAdjustmentRequestItem`(`itemType`);

ALTER TABLE `StudentAdjustmentRequest`
  ADD CONSTRAINT `StudentAdjustmentRequest_registrationWorkspaceId_fkey`
    FOREIGN KEY (`registrationWorkspaceId`) REFERENCES `RegistrationWorkspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `StudentAdjustmentRequest_registrationWindowId_fkey`
    FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `StudentAdjustmentRequest_studentId_fkey`
    FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `StudentAdjustmentRequest_candidateId_fkey`
    FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `StudentAdjustmentRequest_teacherReviewedByUserId_fkey`
    FOREIGN KEY (`teacherReviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `StudentAdjustmentRequest_eoReviewedByUserId_fkey`
    FOREIGN KEY (`eoReviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `StudentAdjustmentRequestItem`
  ADD CONSTRAINT `StudentAdjustmentRequestItem_requestId_fkey`
    FOREIGN KEY (`requestId`) REFERENCES `StudentAdjustmentRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `StudentAdjustmentRequestItem_targetExamSessionId_fkey`
    FOREIGN KEY (`targetExamSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
