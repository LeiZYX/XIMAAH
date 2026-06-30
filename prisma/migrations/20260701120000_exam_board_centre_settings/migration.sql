-- AlterTable
ALTER TABLE `ExamBoard` ADD COLUMN `centreName` VARCHAR(191) NULL,
    ADD COLUMN `centreNumber` VARCHAR(191) NULL,
    ADD COLUMN `centreAddress` TEXT NULL,
    ADD COLUMN `centreEmail` VARCHAR(191) NULL,
    ADD COLUMN `centrePhone` VARCHAR(191) NULL,
    ADD COLUMN `centreCountry` VARCHAR(191) NULL,
    ADD COLUMN `centreTimeZone` VARCHAR(191) NULL,
    ADD COLUMN `defaultExamOfficerName` VARCHAR(191) NULL,
    ADD COLUMN `defaultExamOfficerEmail` VARCHAR(191) NULL;
