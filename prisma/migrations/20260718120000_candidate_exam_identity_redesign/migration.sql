-- Redesign CandidateExamIdentity: status enum, field renames, audit columns, drop fee flag.

-- Add new columns before migrating status values.
ALTER TABLE `CandidateExamIdentity`
  ADD COLUMN `status` ENUM('PENDING', 'REGISTERED', 'WITHDRAWN', 'ARCHIVED') NOT NULL DEFAULT 'PENDING' AFTER `uci`,
  ADD COLUMN `registeredAt` DATETIME(3) NULL AFTER `status`,
  ADD COLUMN `createdByUserId` VARCHAR(191) NULL AFTER `updatedAt`,
  ADD COLUMN `updatedByUserId` VARCHAR(191) NULL AFTER `createdByUserId`;

-- Map legacy registrationStatus values to the new status enum.
UPDATE `CandidateExamIdentity`
SET `status` = CASE
  WHEN `registrationStatus` = 'NOT_REGISTERED' THEN 'PENDING'
  WHEN `registrationStatus` = 'REGISTERED' THEN 'REGISTERED'
  WHEN `registrationStatus` = 'WITHDRAWN' THEN 'WITHDRAWN'
  ELSE 'PENDING'
END;

-- Backfill registeredAt for identities already marked registered.
UPDATE `CandidateExamIdentity`
SET `registeredAt` = `updatedAt`
WHERE `status` = 'REGISTERED' AND `registeredAt` IS NULL;

-- Rename identifier columns to the new model field names.
ALTER TABLE `CandidateExamIdentity`
  CHANGE COLUMN `boardCandidateNumber` `candidateNumber` VARCHAR(191) NULL,
  CHANGE COLUMN `uci` `uciNumber` VARCHAR(191) NULL;

-- Drop legacy columns and indexes.
ALTER TABLE `CandidateExamIdentity`
  DROP INDEX `CandidateExamIdentity_registrationStatus_idx`,
  DROP INDEX `CandidateExamIdentity_registrationFeePaid_idx`,
  DROP INDEX `CandidateExamIdentity_boardCandidateNumber_idx`,
  DROP COLUMN `registrationStatus`,
  DROP COLUMN `registrationFeePaid`;

-- Create indexes for the redesigned model.
CREATE INDEX `CandidateExamIdentity_candidateNumber_idx` ON `CandidateExamIdentity`(`candidateNumber`);
CREATE INDEX `CandidateExamIdentity_status_idx` ON `CandidateExamIdentity`(`status`);
CREATE INDEX `CandidateExamIdentity_registeredAt_idx` ON `CandidateExamIdentity`(`registeredAt`);
CREATE INDEX `CandidateExamIdentity_createdByUserId_idx` ON `CandidateExamIdentity`(`createdByUserId`);
CREATE INDEX `CandidateExamIdentity_updatedByUserId_idx` ON `CandidateExamIdentity`(`updatedByUserId`);

-- Audit user foreign keys.
ALTER TABLE `CandidateExamIdentity`
  ADD CONSTRAINT `CandidateExamIdentity_createdByUserId_fkey`
    FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `CandidateExamIdentity_updatedByUserId_fkey`
    FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
