-- CreateTable
CREATE TABLE `RegistrationWindowIncludedSeries` (
    `id` VARCHAR(191) NOT NULL,
    `registrationWindowId` VARCHAR(191) NOT NULL,
    `examSeriesId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `rw_included_series_uq`(`registrationWindowId`, `examSeriesId`),
    INDEX `RegistrationWindowIncludedSeries_examSeriesId_idx`(`examSeriesId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill from legacy single-series windows
INSERT INTO `RegistrationWindowIncludedSeries` (`id`, `registrationWindowId`, `examSeriesId`, `createdAt`)
SELECT CONCAT('rwis-', `id`), `id`, `examSeriesId`, NOW(3)
FROM `RegistrationWindow`;

-- AddForeignKey
ALTER TABLE `RegistrationWindowIncludedSeries` ADD CONSTRAINT `RegistrationWindowIncludedSeries_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationWindowIncludedSeries` ADD CONSTRAINT `RegistrationWindowIncludedSeries_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
