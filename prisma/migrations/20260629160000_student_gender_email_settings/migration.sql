-- AlterTable
ALTER TABLE `StudentProfile` ADD COLUMN `idCardNumber` VARCHAR(191) NULL,
    ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL;

-- CreateTable
CREATE TABLE `SystemEmailSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `smtpHost` VARCHAR(191) NULL,
    `smtpPort` INTEGER NOT NULL DEFAULT 587,
    `smtpSecure` BOOLEAN NOT NULL DEFAULT false,
    `smtpUser` VARCHAR(191) NULL,
    `smtpPassword` VARCHAR(191) NULL,
    `mailFrom` VARCHAR(191) NULL,
    `passwordResetExpiresMinutes` INTEGER NOT NULL DEFAULT 60,
    `appUrl` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill TeacherProfile for existing teachers without one
INSERT INTO `TeacherProfile` (`id`, `userId`, `phone`, `email`, `status`, `visibleGrades`, `visibleClasses`, `createdAt`, `updatedAt`)
SELECT
    CONCAT('tp_', `User`.`id`),
    `User`.`id`,
    `User`.`phone`,
    `User`.`email`,
    'ACTIVE',
    NULL,
    NULL,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM `User`
WHERE `User`.`role` = 'SUBJECT_TEACHER'
  AND NOT EXISTS (
    SELECT 1 FROM `TeacherProfile` WHERE `TeacherProfile`.`userId` = `User`.`id`
  );
