-- AlterTable
ALTER TABLE `FeeSchedule` ADD COLUMN `examSeriesId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `FeeSchedule_examSeriesId_idx` ON `FeeSchedule`(`examSeriesId`);

-- AddForeignKey
ALTER TABLE `FeeSchedule` ADD CONSTRAINT `FeeSchedule_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
