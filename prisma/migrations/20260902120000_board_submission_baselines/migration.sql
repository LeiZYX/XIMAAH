-- CreateTable
CREATE TABLE `BoardSubmissionBaseline` (
    `id` VARCHAR(191) NOT NULL,
    `registrationWindowId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `kind` ENUM('BULK_ENTRIES', 'AMENDMENT') NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedByUserId` VARCHAR(191) NULL,
    `candidateCount` INTEGER NOT NULL DEFAULT 0,
    `entryCount` INTEGER NOT NULL DEFAULT 0,
    `fileCount` INTEGER NOT NULL DEFAULT 1,
    `notes` TEXT NULL,

    INDEX `BoardSubmissionBaseline_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `BoardSubmissionBaseline_submittedAt_idx`(`submittedAt`),
    UNIQUE INDEX `BoardSubmissionBaseline_registrationWindowId_version_key`(`registrationWindowId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BoardSubmissionBaseline` ADD CONSTRAINT `BoardSubmissionBaseline_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BoardSubmissionBaseline` ADD CONSTRAINT `BoardSubmissionBaseline_submittedByUserId_fkey` FOREIGN KEY (`submittedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
