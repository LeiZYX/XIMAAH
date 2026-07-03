-- AlterTable
ALTER TABLE `CandidateExamIdentity`
  ADD COLUMN `registrationStatus` ENUM('NOT_REGISTERED', 'REGISTERED', 'WITHDRAWN') NOT NULL DEFAULT 'NOT_REGISTERED',
  ADD COLUMN `registrationFeePaid` BOOLEAN NOT NULL DEFAULT false,
  MODIFY `notes` TEXT NULL;

-- CreateIndex
CREATE INDEX `CandidateExamIdentity_registrationStatus_idx` ON `CandidateExamIdentity`(`registrationStatus`);

-- CreateIndex
CREATE INDEX `CandidateExamIdentity_registrationFeePaid_idx` ON `CandidateExamIdentity`(`registrationFeePaid`);
