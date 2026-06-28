-- AlterTable
ALTER TABLE `FeeAuditLog` MODIFY `metadata` TEXT NULL,
    MODIFY `note` TEXT NULL;

-- AlterTable
ALTER TABLE `FeeStatement` MODIFY `paymentNotes` TEXT NULL;

-- AlterTable
ALTER TABLE `RegistrationAuditLog` MODIFY `beforeValue` TEXT NULL,
    MODIFY `afterValue` TEXT NULL,
    MODIFY `reason` TEXT NULL,
    MODIFY `note` TEXT NULL;

-- AlterTable
ALTER TABLE `RegistrationChangeRequest` MODIFY `reason` TEXT NOT NULL,
    MODIFY `reviewNote` TEXT NULL;

-- AlterTable
ALTER TABLE `RegistrationWorkspace` MODIFY `lastAdjustmentReason` TEXT NULL,
    MODIFY `lastAdjustmentSummary` TEXT NULL;

-- AlterTable
ALTER TABLE `StudentExamRegistration` MODIFY `reason` TEXT NULL;
