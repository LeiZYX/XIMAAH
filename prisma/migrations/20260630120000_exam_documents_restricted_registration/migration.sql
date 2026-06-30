-- RegistrationType and visibility flags
ALTER TABLE `RegistrationWorkspace`
  ADD COLUMN `registrationType` ENUM('NORMAL', 'RESTRICTED', 'EXTERNAL') NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN `visibleToStudent` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `visibleToTeacher` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `visibleInStudentPortal` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `visibleInTeacherPortal` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `visibleInStudentDocuments` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `visibleInStudentBilling` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `restrictedReason` TEXT NULL,
  ADD COLUMN `restrictedCreatedById` VARCHAR(191) NULL,
  ADD COLUMN `restrictedCreatedAt` DATETIME(3) NULL,
  ADD COLUMN `restrictedUpdatedById` VARCHAR(191) NULL,
  ADD COLUMN `restrictedUpdatedAt` DATETIME(3) NULL;

ALTER TABLE `StudentExamRegistration`
  ADD COLUMN `registrationType` ENUM('NORMAL', 'RESTRICTED', 'EXTERNAL') NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN `visibleToStudent` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `visibleToTeacher` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `visibleInStudentPortal` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `visibleInTeacherPortal` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `visibleInStudentDocuments` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `visibleInStudentBilling` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `FeeStatement`
  ADD COLUMN `statementKind` ENUM('NORMAL', 'RESTRICTED') NOT NULL DEFAULT 'NORMAL';

-- Backfill registration types from existing visibility/source
UPDATE `RegistrationWorkspace`
SET
  `registrationType` = 'EXTERNAL',
  `visibleToStudent` = false,
  `visibleToTeacher` = false,
  `visibleInStudentPortal` = false,
  `visibleInTeacherPortal` = false,
  `visibleInStudentDocuments` = true,
  `visibleInStudentBilling` = false
WHERE `registrationSource` = 'EXTERNAL_CANDIDATE';

UPDATE `RegistrationWorkspace`
SET
  `registrationType` = 'RESTRICTED',
  `visibleToStudent` = false,
  `visibleToTeacher` = false,
  `visibleInStudentPortal` = false,
  `visibleInTeacherPortal` = false,
  `visibleInStudentDocuments` = false,
  `visibleInStudentBilling` = false,
  `restrictedReason` = COALESCE(`lastAdjustmentReason`, 'Migrated restricted registration'),
  `restrictedCreatedAt` = COALESCE(`lastAdjustedAt`, `createdAt`)
WHERE `visibility` = 'EXAM_OFFICE_ONLY'
  AND `registrationSource` != 'EXTERNAL_CANDIDATE';

UPDATE `StudentExamRegistration` r
INNER JOIN `RegistrationWorkspace` w ON w.id = r.registrationWorkspaceId
SET
  r.registrationType = w.registrationType,
  r.visibleToStudent = w.visibleToStudent,
  r.visibleToTeacher = w.visibleToTeacher,
  r.visibleInStudentPortal = w.visibleInStudentPortal,
  r.visibleInTeacherPortal = w.visibleInTeacherPortal,
  r.visibleInStudentDocuments = w.visibleInStudentDocuments,
  r.visibleInStudentBilling = w.visibleInStudentBilling
WHERE r.registrationWorkspaceId IS NOT NULL;

UPDATE `StudentExamRegistration`
SET
  `registrationType` = 'EXTERNAL',
  `visibleToStudent` = false,
  `visibleToTeacher` = false,
  `visibleInStudentPortal` = false,
  `visibleInTeacherPortal` = false,
  `visibleInStudentDocuments` = true,
  `visibleInStudentBilling` = false
WHERE `registrationSource` = 'EXTERNAL_CANDIDATE'
  AND `registrationType` = 'NORMAL';

UPDATE `StudentExamRegistration`
SET
  `registrationType` = 'RESTRICTED',
  `visibleToStudent` = false,
  `visibleToTeacher` = false,
  `visibleInStudentPortal` = false,
  `visibleInTeacherPortal` = false,
  `visibleInStudentDocuments` = false,
  `visibleInStudentBilling` = false
WHERE `visibility` = 'EXAM_OFFICE_ONLY'
  AND `registrationSource` != 'EXTERNAL_CANDIDATE'
  AND `registrationType` = 'NORMAL';

CREATE TABLE `ExamDocumentAuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `action` ENUM(
    'EXAM_DOCUMENT_PREVIEWED',
    'EXAM_DOCUMENT_PRINTED',
    'EXAM_DOCUMENT_DOWNLOADED',
    'STATEMENT_OF_ENTRY_PRINTED',
    'ATTENDANCE_REGISTER_PRINTED',
    'SEATING_PLAN_PRINTED',
    'CANDIDATE_LIST_EXPORTED',
    'RESTRICTED_REGISTRATION_CREATED',
    'RESTRICTED_REGISTRATION_UPDATED',
    'RESTRICTED_REGISTRATION_CANCELLED',
    'RESTRICTED_INVOICE_PRINTED',
    'RESTRICTED_INVOICE_DOWNLOADED'
  ) NOT NULL,
  `documentType` ENUM(
    'STATEMENT_OF_ENTRY',
    'CANDIDATE_TIMETABLE',
    'ATTENDANCE_REGISTER',
    'SEATING_PLAN',
    'DESK_LABELS',
    'CANDIDATE_LABELS',
    'CANDIDATE_LIST',
    'SUBJECT_CANDIDATE_LIST',
    'ROOM_CANDIDATE_LIST',
    'MISSING_CANDIDATE_REPORT',
    'NORMAL_FEE_STATEMENT',
    'RESTRICTED_INVOICE',
    'RESULT_SLIP',
    'CERTIFICATE_COLLECTION_LIST'
  ) NULL,
  `registrationWindowId` VARCHAR(191) NULL,
  `examSessionId` VARCHAR(191) NULL,
  `candidateId` VARCHAR(191) NULL,
  `candidateCount` INTEGER NULL,
  `performedById` VARCHAR(191) NOT NULL,
  `metadata` JSON NULL,
  `reason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ExamDocumentAuditLog_action_idx`(`action`),
  INDEX `ExamDocumentAuditLog_documentType_idx`(`documentType`),
  INDEX `ExamDocumentAuditLog_registrationWindowId_idx`(`registrationWindowId`),
  INDEX `ExamDocumentAuditLog_examSessionId_idx`(`examSessionId`),
  INDEX `ExamDocumentAuditLog_candidateId_idx`(`candidateId`),
  INDEX `ExamDocumentAuditLog_performedById_idx`(`performedById`),
  INDEX `ExamDocumentAuditLog_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ExamDocumentAuditLog`
  ADD CONSTRAINT `ExamDocumentAuditLog_registrationWindowId_fkey`
    FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ExamDocumentAuditLog_examSessionId_fkey`
    FOREIGN KEY (`examSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ExamDocumentAuditLog_candidateId_fkey`
    FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ExamDocumentAuditLog_performedById_fkey`
    FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `RegistrationWorkspace`
  ADD CONSTRAINT `RegistrationWorkspace_restrictedCreatedById_fkey`
    FOREIGN KEY (`restrictedCreatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `RegistrationWorkspace_restrictedUpdatedById_fkey`
    FOREIGN KEY (`restrictedUpdatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `RegistrationWorkspace_registrationType_idx` ON `RegistrationWorkspace`(`registrationType`);
CREATE INDEX `StudentExamRegistration_registrationType_idx` ON `StudentExamRegistration`(`registrationType`);
CREATE INDEX `FeeStatement_statementKind_idx` ON `FeeStatement`(`statementKind`);

-- Extend registration audit action enum
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
    'EO_RESTRICTED_REGISTRATION_CREATED', 'ADMIN_RESTRICTED_REGISTRATION_CREATED',
    'RESTRICTED_REGISTRATION_UPDATED', 'RESTRICTED_REGISTRATION_CANCELLED',
    'EO_POST_LOCK_ADJUSTMENT', 'ADMIN_POST_LOCK_ADJUSTMENT',
    'STUDENT_REGISTRATION_SUBMITTED', 'EXTERNAL_CANDIDATE_REGISTRATION_CREATED',
    'REGISTRATION_STAGE_CREATED', 'REGISTRATION_STAGE_UPDATED', 'REGISTRATION_STAGE_DISABLED',
    'FEE_STAGE_CREATED', 'FEE_STAGE_UPDATED',
    'STUDENT_REGISTRATION_OPENED', 'STUDENT_REGISTRATION_CLOSED', 'REGISTRATION_WINDOW_CLOSED',
    'ENTRY_TYPE_AUTO_ASSIGNED', 'ENTRY_TYPE_OVERRIDDEN', 'ENTRY_TYPE_DEFAULTED_TO_NORMAL',
    'POST_STUDENT_CLOSE_ADJUSTMENT', 'POST_WINDOW_CLOSE_OVERRIDE'
  ) NOT NULL;
