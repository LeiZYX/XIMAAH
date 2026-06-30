-- AlterTable
ALTER TABLE `RegistrationWindow` ADD COLUMN `academicYear` VARCHAR(191) NULL;

-- Backfill from exam series calendar year (Summer 2026 → 2025/26)
UPDATE `RegistrationWindow` rw
INNER JOIN `ExamSeries` es ON rw.`examSeriesId` = es.`id`
SET rw.`academicYear` = CONCAT(es.`year` - 1, '/', RIGHT(es.`year`, 2));

-- Fallback from student registration open date (September academic year boundary)
UPDATE `RegistrationWindow`
SET `academicYear` = CASE
  WHEN MONTH(`studentRegistrationOpenAt`) >= 9
    THEN CONCAT(YEAR(`studentRegistrationOpenAt`), '/', RIGHT(YEAR(`studentRegistrationOpenAt`) + 1, 2))
  ELSE CONCAT(YEAR(`studentRegistrationOpenAt`) - 1, '/', RIGHT(YEAR(`studentRegistrationOpenAt`), 2))
END
WHERE `academicYear` IS NULL;

-- AlterTable
ALTER TABLE `RegistrationWindow` MODIFY `academicYear` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `RegistrationWindow_academicYear_idx` ON `RegistrationWindow`(`academicYear`);
