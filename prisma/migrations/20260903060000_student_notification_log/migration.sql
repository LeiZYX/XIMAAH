-- CreateTable
CREATE TABLE `StudentNotificationLog` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('REG_LOCKED', 'FEE_ISSUED') NOT NULL,
    `status` ENUM('SENT', 'FAILED', 'SKIPPED') NOT NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `studentUserId` VARCHAR(191) NULL,
    `recipientEmail` VARCHAR(191) NULL,
    `registrationWindowId` VARCHAR(191) NULL,
    `feeStatementId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,

    UNIQUE INDEX `StudentNotificationLog_dedupeKey_key`(`dedupeKey`),
    INDEX `StudentNotificationLog_type_idx`(`type`),
    INDEX `StudentNotificationLog_status_idx`(`status`),
    INDEX `StudentNotificationLog_studentUserId_idx`(`studentUserId`),
    INDEX `StudentNotificationLog_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `StudentNotificationLog_feeStatementId_idx`(`feeStatementId`),
    INDEX `StudentNotificationLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StudentNotificationLog` ADD CONSTRAINT `StudentNotificationLog_studentUserId_fkey` FOREIGN KEY (`studentUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentNotificationLog` ADD CONSTRAINT `StudentNotificationLog_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentNotificationLog` ADD CONSTRAINT `StudentNotificationLog_feeStatementId_fkey` FOREIGN KEY (`feeStatementId`) REFERENCES `FeeStatement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
