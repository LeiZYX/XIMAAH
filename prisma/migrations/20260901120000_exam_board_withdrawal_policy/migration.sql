-- Phase 1: exam-board withdrawal refund policy + copy fields on windows / fee stages

ALTER TABLE `RegistrationWindow`
  ADD COLUMN `paymentFeePercent` DECIMAL(5, 2) NOT NULL DEFAULT 2;

ALTER TABLE `RegistrationFeeStage`
  ADD COLUMN `withdrawalRefundEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `withdrawalRefundPercent` DECIMAL(5, 2) NOT NULL DEFAULT 100,
  ADD COLUMN `withdrawalRefundBasis` ENUM('SALES_AMOUNT') NOT NULL DEFAULT 'SALES_AMOUNT',
  ADD COLUMN `withdrawalNotes` TEXT NULL;

CREATE TABLE `ExamBoardWithdrawalPolicy` (
  `id` VARCHAR(191) NOT NULL,
  `examBoardId` VARCHAR(191) NOT NULL,
  `paymentFeePercent` DECIMAL(5, 2) NOT NULL DEFAULT 2,
  `refundBasis` ENUM('SALES_AMOUNT') NOT NULL DEFAULT 'SALES_AMOUNT',
  `normalRefundEnabled` BOOLEAN NOT NULL DEFAULT true,
  `normalRefundPercent` DECIMAL(5, 2) NOT NULL DEFAULT 100,
  `lateRefundEnabled` BOOLEAN NOT NULL DEFAULT true,
  `lateRefundPercent` DECIMAL(5, 2) NOT NULL DEFAULT 50,
  `highLateRefundEnabled` BOOLEAN NOT NULL DEFAULT false,
  `highLateRefundPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ExamBoardWithdrawalPolicy_examBoardId_key`(`examBoardId`),
  CONSTRAINT `ExamBoardWithdrawalPolicy_examBoardId_fkey`
    FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed defaults for existing exam boards
INSERT INTO `ExamBoardWithdrawalPolicy` (
  `id`, `examBoardId`, `paymentFeePercent`, `refundBasis`,
  `normalRefundEnabled`, `normalRefundPercent`,
  `lateRefundEnabled`, `lateRefundPercent`,
  `highLateRefundEnabled`, `highLateRefundPercent`,
  `createdAt`, `updatedAt`
)
SELECT
  CONCAT('wpol_', `id`),
  `id`,
  2,
  'SALES_AMOUNT',
  true,
  100,
  true,
  50,
  false,
  0,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `ExamBoard`
WHERE NOT EXISTS (
  SELECT 1 FROM `ExamBoardWithdrawalPolicy` p WHERE p.`examBoardId` = `ExamBoard`.`id`
);

-- Align existing fee stages with frozen defaults by stage code
UPDATE `RegistrationFeeStage`
SET
  `withdrawalRefundEnabled` = true,
  `withdrawalRefundPercent` = 100,
  `withdrawalNotes` = NULL
WHERE `stageCode` = 'NORMAL';

UPDATE `RegistrationFeeStage`
SET
  `withdrawalRefundEnabled` = true,
  `withdrawalRefundPercent` = 50,
  `withdrawalNotes` = 'Late withdrawal — default 50% of sales amount'
WHERE `stageCode` = 'LATE';

UPDATE `RegistrationFeeStage`
SET
  `withdrawalRefundEnabled` = false,
  `withdrawalRefundPercent` = 0,
  `withdrawalNotes` = 'High late withdrawal — exam fee non-refundable'
WHERE `stageCode` = 'HIGH_LATE';
