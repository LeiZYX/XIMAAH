-- AlterEnum
ALTER TABLE `StudentNotificationLog` MODIFY COLUMN `type` ENUM('REG_LOCKED', 'FEE_ISSUED', 'REG_UPDATED', 'FEE_PAID') NOT NULL;

-- AlterTable
ALTER TABLE `SystemEmailSettings` ADD COLUMN `notifyRegistrationUpdated` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notifyFeeStatementPaid` BOOLEAN NOT NULL DEFAULT true;
