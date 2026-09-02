-- CreateTable
CREATE TABLE `CalendarPaperSelection` (
    `id` VARCHAR(191) NOT NULL,
    `examBoardId` VARCHAR(191) NOT NULL,
    `paperId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CalendarPaperSelection_examBoardId_idx`(`examBoardId`),
    INDEX `CalendarPaperSelection_paperId_idx`(`paperId`),
    UNIQUE INDEX `CalendarPaperSelection_examBoardId_paperId_key`(`examBoardId`, `paperId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CalendarPaperSelection` ADD CONSTRAINT `CalendarPaperSelection_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarPaperSelection` ADD CONSTRAINT `CalendarPaperSelection_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
