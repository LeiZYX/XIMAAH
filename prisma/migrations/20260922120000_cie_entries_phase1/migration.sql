-- CIE phase 1: option catalogue, entry assignments, subject confirmation, CIE baseline

ALTER TABLE `StudentExamRegistration`
  MODIFY COLUMN `status` ENUM('ACTIVE', 'CANCELLED', 'LOCKED', 'PENDING_SUBJECT_TEACHER') NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE `BoardSubmissionBaseline`
  MODIFY COLUMN `kind` ENUM('BULK_ENTRIES', 'AMENDMENT', 'CIE_ENTRIES') NOT NULL;

ALTER TABLE `RegistrationWindow`
  ADD COLUMN `requireSubjectTeacherConfirmation` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `CieBoardSubmissionBaseline` (
    `id` VARCHAR(191) NOT NULL,
    `registrationWindowId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedByUserId` VARCHAR(191) NULL,
    `candidateCount` INTEGER NOT NULL DEFAULT 0,
    `entryCount` INTEGER NOT NULL DEFAULT 0,
    `fileCount` INTEGER NOT NULL DEFAULT 1,
    `notes` TEXT NULL,
    `entrySnapshot` JSON NULL,

    INDEX `CieBoardSubmissionBaseline_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `CieBoardSubmissionBaseline_submittedAt_idx`(`submittedAt`),
    UNIQUE INDEX `CieBoardSubmissionBaseline_registrationWindowId_version_key`(`registrationWindowId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CieSyllabusOption` (
    `id` VARCHAR(191) NOT NULL,
    `examBoardId` VARCHAR(191) NOT NULL,
    `examSeriesId` VARCHAR(191) NOT NULL,
    `syllabusCode` VARCHAR(191) NOT NULL,
    `syllabusTitle` VARCHAR(191) NULL,
    `optionCode` VARCHAR(191) NOT NULL,
    `componentCodes` JSON NOT NULL,
    `disallowedSyllabusCodes` JSON NULL,
    `subjectId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CieSyllabusOption_examBoardId_idx`(`examBoardId`),
    INDEX `CieSyllabusOption_examSeriesId_idx`(`examSeriesId`),
    INDEX `CieSyllabusOption_syllabusCode_idx`(`syllabusCode`),
    INDEX `CieSyllabusOption_subjectId_idx`(`subjectId`),
    INDEX `CieSyllabusOption_active_idx`(`active`),
    UNIQUE INDEX `cie_option_series_syllabus_option_uq`(`examSeriesId`, `syllabusCode`, `optionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CieEntryAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `registrationWindowId` VARCHAR(191) NOT NULL,
    `registrationWorkspaceId` VARCHAR(191) NULL,
    `candidateId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `syllabusCode` VARCHAR(191) NOT NULL,
    `optionCode` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'CANCELLED', 'LOCKED', 'PENDING_SUBJECT_TEACHER') NOT NULL DEFAULT 'ACTIVE',
    `confirmedByUserId` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `rejectedReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CieEntryAssignment_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `CieEntryAssignment_registrationWorkspaceId_idx`(`registrationWorkspaceId`),
    INDEX `CieEntryAssignment_candidateId_idx`(`candidateId`),
    INDEX `CieEntryAssignment_studentId_idx`(`studentId`),
    INDEX `CieEntryAssignment_subjectId_idx`(`subjectId`),
    INDEX `CieEntryAssignment_status_idx`(`status`),
    INDEX `CieEntryAssignment_syllabusCode_optionCode_idx`(`syllabusCode`, `optionCode`),
    UNIQUE INDEX `cie_assignment_candidate_window_syllabus_uq`(`candidateId`, `registrationWindowId`, `syllabusCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CieBoardSubmissionBaseline` ADD CONSTRAINT `CieBoardSubmissionBaseline_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CieBoardSubmissionBaseline` ADD CONSTRAINT `CieBoardSubmissionBaseline_submittedByUserId_fkey` FOREIGN KEY (`submittedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CieSyllabusOption` ADD CONSTRAINT `CieSyllabusOption_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CieSyllabusOption` ADD CONSTRAINT `CieSyllabusOption_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CieSyllabusOption` ADD CONSTRAINT `CieSyllabusOption_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CieEntryAssignment` ADD CONSTRAINT `CieEntryAssignment_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CieEntryAssignment` ADD CONSTRAINT `CieEntryAssignment_registrationWorkspaceId_fkey` FOREIGN KEY (`registrationWorkspaceId`) REFERENCES `RegistrationWorkspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CieEntryAssignment` ADD CONSTRAINT `CieEntryAssignment_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CieEntryAssignment` ADD CONSTRAINT `CieEntryAssignment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CieEntryAssignment` ADD CONSTRAINT `CieEntryAssignment_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CieEntryAssignment` ADD CONSTRAINT `CieEntryAssignment_confirmedByUserId_fkey` FOREIGN KEY (`confirmedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
