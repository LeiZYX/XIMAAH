-- CreateTable
CREATE TABLE `CashInCode` (
    `id` VARCHAR(191) NOT NULL,
    `examBoardId` VARCHAR(191) NOT NULL,
    `qualificationId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `cashInCode` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CashInCode_examBoardId_qualificationId_subjectId_key`(`examBoardId`, `qualificationId`, `subjectId`),
    UNIQUE INDEX `CashInCode_examBoardId_cashInCode_key`(`examBoardId`, `cashInCode`),
    INDEX `CashInCode_examBoardId_idx`(`examBoardId`),
    INDEX `CashInCode_qualificationId_idx`(`qualificationId`),
    INDEX `CashInCode_subjectId_idx`(`subjectId`),
    INDEX `CashInCode_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CashInCode` ADD CONSTRAINT `CashInCode_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashInCode` ADD CONSTRAINT `CashInCode_qualificationId_fkey` FOREIGN KEY (`qualificationId`) REFERENCES `Qualification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashInCode` ADD CONSTRAINT `CashInCode_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
