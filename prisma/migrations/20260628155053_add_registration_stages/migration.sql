-- AlterTable
ALTER TABLE `RegistrationAuditLog` ADD COLUMN `entryType` ENUM('NORMAL', 'LATE', 'HIGH_LATE') NULL,
    ADD COLUMN `registrationStageId` VARCHAR(191) NULL,
    ADD COLUMN `registrationWindowId` VARCHAR(191) NULL,
    MODIFY `examSessionId` VARCHAR(191) NULL,
    MODIFY `action` ENUM('ADD', 'REMOVE', 'SUBMIT', 'UPDATE', 'CANCEL', 'LOCK', 'ADMIN_ADJUST', 'STUDENT_ADD', 'STUDENT_REMOVE', 'STUDENT_SUBMIT', 'SYSTEM_LOCK', 'EO_ADD_AFTER_LOCK', 'EO_REMOVE_AFTER_LOCK', 'EO_REPLACE_AFTER_LOCK', 'ADMIN_ADD_AFTER_LOCK', 'ADMIN_REMOVE_AFTER_LOCK', 'ADMIN_REPLACE_AFTER_LOCK', 'TEACHER_CHANGE_REQUEST', 'TEACHER_REQUEST_APPROVED', 'TEACHER_REQUEST_REJECTED', 'TEACHER_LATE_REGISTRATION_REQUEST', 'TEACHER_LATE_REGISTRATION_APPROVED', 'TEACHER_LATE_REGISTRATION_REJECTED', 'EO_LATE_REGISTRATION_CREATED', 'ADMIN_LATE_REGISTRATION_CREATED', 'EO_ASSISTED_REGISTRATION_CREATED', 'ADMIN_ASSISTED_REGISTRATION_CREATED', 'EO_OFFICE_ONLY_REGISTRATION_CREATED', 'ADMIN_OFFICE_ONLY_REGISTRATION_CREATED', 'EO_POST_LOCK_ADJUSTMENT', 'ADMIN_POST_LOCK_ADJUSTMENT', 'STUDENT_REGISTRATION_SUBMITTED', 'EXTERNAL_CANDIDATE_REGISTRATION_CREATED', 'REGISTRATION_STAGE_CREATED', 'REGISTRATION_STAGE_UPDATED', 'REGISTRATION_STAGE_DISABLED', 'ENTRY_TYPE_AUTO_ASSIGNED', 'ENTRY_TYPE_OVERRIDDEN') NOT NULL;

-- AlterTable
ALTER TABLE `RegistrationWindow` ADD COLUMN `eoAssistedRegistrationEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `officeOnlyRegistrationEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `postLockAdjustmentEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `studentSelfRegistrationEnabled` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `RegistrationWorkspace` ADD COLUMN `entryType` ENUM('NORMAL', 'LATE', 'HIGH_LATE') NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `entryTypeOverridden` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `entryTypeOverrideReason` TEXT NULL,
    ADD COLUMN `registrationStageId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `StudentExamRegistration` ADD COLUMN `entryType` ENUM('NORMAL', 'LATE', 'HIGH_LATE') NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `entryTypeOverridden` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `entryTypeOverrideReason` TEXT NULL,
    ADD COLUMN `registrationStageId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `RegistrationStage` (
    `id` VARCHAR(191) NOT NULL,
    `registrationWindowId` VARCHAR(191) NOT NULL,
    `stageCode` ENUM('NORMAL', 'LATE', 'HIGH_LATE') NOT NULL,
    `stageName` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RegistrationStage_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `RegistrationStage_enabled_idx`(`enabled`),
    INDEX `RegistrationStage_sequence_idx`(`sequence`),
    UNIQUE INDEX `RegistrationStage_registrationWindowId_stageCode_key`(`registrationWindowId`, `stageCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `RegistrationAuditLog_registrationWindowId_idx` ON `RegistrationAuditLog`(`registrationWindowId`);

-- CreateIndex
CREATE INDEX `RegistrationAuditLog_registrationStageId_idx` ON `RegistrationAuditLog`(`registrationStageId`);

-- CreateIndex
CREATE INDEX `RegistrationWorkspace_entryType_idx` ON `RegistrationWorkspace`(`entryType`);

-- CreateIndex
CREATE INDEX `RegistrationWorkspace_registrationStageId_idx` ON `RegistrationWorkspace`(`registrationStageId`);

-- CreateIndex
CREATE INDEX `StudentExamRegistration_entryType_idx` ON `StudentExamRegistration`(`entryType`);

-- CreateIndex
CREATE INDEX `StudentExamRegistration_registrationStageId_idx` ON `StudentExamRegistration`(`registrationStageId`);

-- AddForeignKey
ALTER TABLE `RegistrationStage` ADD CONSTRAINT `RegistrationStage_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationWorkspace` ADD CONSTRAINT `RegistrationWorkspace_registrationStageId_fkey` FOREIGN KEY (`registrationStageId`) REFERENCES `RegistrationStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_registrationStageId_fkey` FOREIGN KEY (`registrationStageId`) REFERENCES `RegistrationStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationAuditLog` ADD CONSTRAINT `RegistrationAuditLog_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationAuditLog` ADD CONSTRAINT `RegistrationAuditLog_registrationStageId_fkey` FOREIGN KEY (`registrationStageId`) REFERENCES `RegistrationStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
