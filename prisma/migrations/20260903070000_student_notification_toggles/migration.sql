-- AlterTable
ALTER TABLE `SystemEmailSettings` ADD COLUMN `studentNotificationsEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `notifyRegistrationLocked` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notifyFeeStatementIssued` BOOLEAN NOT NULL DEFAULT true;
