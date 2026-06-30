-- AlterTable
ALTER TABLE `RegistrationAuditLog`
    ADD COLUMN `registrationType` ENUM('INTERNAL_NORMAL', 'RESTRICTED_INTERNAL', 'EXTERNAL') NULL,
    ADD COLUMN `registrationNumber` VARCHAR(191) NULL,
    ADD COLUMN `feeStatementNumber` VARCHAR(191) NULL,
    ADD COLUMN `issueNumber` VARCHAR(191) NULL;

CREATE INDEX `RegistrationAuditLog_registrationType_idx` ON `RegistrationAuditLog`(`registrationType`);
