-- Continuation after partial apply (index name fix)
CREATE INDEX `RegistrationWindow_timing_idx`
    ON `RegistrationWindow`(`studentRegistrationOpenAt`, `studentRegistrationCloseAt`, `registrationCloseAt`);

-- Rename registration stages to fee stages (skip if already renamed)
RENAME TABLE `RegistrationStage` TO `RegistrationFeeStage`;

ALTER TABLE `RegistrationWorkspace`
    DROP FOREIGN KEY `RegistrationWorkspace_registrationStageId_fkey`;
ALTER TABLE `StudentExamRegistration`
    DROP FOREIGN KEY `StudentExamRegistration_registrationStageId_fkey`;
ALTER TABLE `RegistrationAuditLog`
    DROP FOREIGN KEY `RegistrationAuditLog_registrationStageId_fkey`;

ALTER TABLE `RegistrationWorkspace`
    CHANGE COLUMN `registrationStageId` `feeStageId` VARCHAR(191) NULL;
ALTER TABLE `StudentExamRegistration`
    CHANGE COLUMN `registrationStageId` `feeStageId` VARCHAR(191) NULL;
ALTER TABLE `RegistrationAuditLog`
    CHANGE COLUMN `registrationStageId` `feeStageId` VARCHAR(191) NULL;

DROP INDEX `RegistrationWorkspace_registrationStageId_idx` ON `RegistrationWorkspace`;
DROP INDEX `StudentExamRegistration_registrationStageId_idx` ON `StudentExamRegistration`;
DROP INDEX `RegistrationAuditLog_registrationStageId_idx` ON `RegistrationAuditLog`;

CREATE INDEX `RegistrationWorkspace_feeStageId_idx` ON `RegistrationWorkspace`(`feeStageId`);
CREATE INDEX `StudentExamRegistration_feeStageId_idx` ON `StudentExamRegistration`(`feeStageId`);
CREATE INDEX `RegistrationAuditLog_feeStageId_idx` ON `RegistrationAuditLog`(`feeStageId`);

ALTER TABLE `RegistrationWorkspace`
    ADD CONSTRAINT `RegistrationWorkspace_feeStageId_fkey`
        FOREIGN KEY (`feeStageId`) REFERENCES `RegistrationFeeStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `StudentExamRegistration`
    ADD CONSTRAINT `StudentExamRegistration_feeStageId_fkey`
        FOREIGN KEY (`feeStageId`) REFERENCES `RegistrationFeeStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RegistrationAuditLog`
    ADD CONSTRAINT `RegistrationAuditLog_feeStageId_fkey`
        FOREIGN KEY (`feeStageId`) REFERENCES `RegistrationFeeStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `RegistrationWindow`
    MODIFY `status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT';

ALTER TABLE `RegistrationAuditLog`
    MODIFY `action` ENUM(
        'ADD', 'REMOVE', 'SUBMIT', 'UPDATE', 'CANCEL', 'LOCK', 'ADMIN_ADJUST',
        'STUDENT_ADD', 'STUDENT_REMOVE', 'STUDENT_SUBMIT', 'SYSTEM_LOCK',
        'EO_ADD_AFTER_LOCK', 'EO_REMOVE_AFTER_LOCK', 'EO_REPLACE_AFTER_LOCK',
        'ADMIN_ADD_AFTER_LOCK', 'ADMIN_REMOVE_AFTER_LOCK', 'ADMIN_REPLACE_AFTER_LOCK',
        'TEACHER_CHANGE_REQUEST', 'TEACHER_REQUEST_APPROVED', 'TEACHER_REQUEST_REJECTED',
        'TEACHER_LATE_REGISTRATION_REQUEST', 'TEACHER_LATE_REGISTRATION_APPROVED', 'TEACHER_LATE_REGISTRATION_REJECTED',
        'EO_LATE_REGISTRATION_CREATED', 'ADMIN_LATE_REGISTRATION_CREATED',
        'EO_ASSISTED_REGISTRATION_CREATED', 'ADMIN_ASSISTED_REGISTRATION_CREATED',
        'EO_OFFICE_ONLY_REGISTRATION_CREATED', 'ADMIN_OFFICE_ONLY_REGISTRATION_CREATED',
        'EO_POST_LOCK_ADJUSTMENT', 'ADMIN_POST_LOCK_ADJUSTMENT',
        'STUDENT_REGISTRATION_SUBMITTED', 'EXTERNAL_CANDIDATE_REGISTRATION_CREATED',
        'REGISTRATION_STAGE_CREATED', 'REGISTRATION_STAGE_UPDATED', 'REGISTRATION_STAGE_DISABLED',
        'FEE_STAGE_CREATED', 'FEE_STAGE_UPDATED',
        'STUDENT_REGISTRATION_OPENED', 'STUDENT_REGISTRATION_CLOSED', 'REGISTRATION_WINDOW_CLOSED',
        'ENTRY_TYPE_AUTO_ASSIGNED', 'ENTRY_TYPE_OVERRIDDEN', 'ENTRY_TYPE_DEFAULTED_TO_NORMAL',
        'POST_STUDENT_CLOSE_ADJUSTMENT', 'POST_WINDOW_CLOSE_OVERRIDE'
    ) NOT NULL;
