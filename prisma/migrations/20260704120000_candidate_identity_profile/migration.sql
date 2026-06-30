-- AlterEnum Gender: add PREFER_NOT_TO_SAY
ALTER TABLE `StudentProfile` MODIFY `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY') NULL;

-- Candidate identity fields
ALTER TABLE `Candidate`
  ADD COLUMN `surnamePinyin` VARCHAR(191) NULL,
  ADD COLUMN `givenNamePinyin` VARCHAR(191) NULL,
  ADD COLUMN `preferredEnglishName` VARCHAR(191) NULL,
  ADD COLUMN `legalEnglishName` VARCHAR(191) NULL,
  ADD COLUMN `nationality` VARCHAR(191) NULL,
  ADD COLUMN `idDocumentType` ENUM('CHINESE_ID_CARD', 'PASSPORT', 'HONG_KONG_ID', 'MACAU_ID', 'TAIWAN_ID', 'OTHER') NULL,
  ADD COLUMN `idDocumentNumber` VARCHAR(191) NULL,
  ADD COLUMN `photoUrl` VARCHAR(191) NULL,
  ADD COLUMN `emergencyContactName` VARCHAR(191) NULL,
  ADD COLUMN `emergencyContactPhone` VARCHAR(191) NULL,
  ADD COLUMN `graduationYear` INT NULL,
  ADD COLUMN `genderNew` ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY') NULL;

UPDATE `Candidate`
SET `genderNew` = CASE
  WHEN UPPER(`gender`) IN ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY') THEN UPPER(`gender`)
  ELSE NULL
END
WHERE `gender` IS NOT NULL;

ALTER TABLE `Candidate` DROP COLUMN `gender`;
ALTER TABLE `Candidate` CHANGE COLUMN `genderNew` `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY') NULL;

UPDATE `Candidate`
SET `legalEnglishName` = `englishName`
WHERE `legalEnglishName` IS NULL AND `englishName` IS NOT NULL;

UPDATE `Candidate`
SET `idDocumentNumber` = COALESCE(`idNumber`, `passportNumber`)
WHERE `idDocumentNumber` IS NULL;

UPDATE `Candidate`
SET `idDocumentType` = 'CHINESE_ID_CARD'
WHERE `idDocumentType` IS NULL AND `idNumber` IS NOT NULL;

UPDATE `Candidate`
SET `idDocumentType` = 'PASSPORT'
WHERE `idDocumentType` IS NULL AND `passportNumber` IS NOT NULL;

CREATE TABLE `CandidateAuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `candidateId` VARCHAR(191) NOT NULL,
  `action` ENUM('CANDIDATE_IDENTITY_UPDATED', 'CANDIDATE_PHOTO_UPLOADED', 'CANDIDATE_PHOTO_REMOVED', 'CANDIDATE_NAME_CHANGED', 'DOCUMENT_NUMBER_CHANGED') NOT NULL,
  `performedById` VARCHAR(191) NOT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `CandidateAuditLog_candidateId_idx`(`candidateId`),
  INDEX `CandidateAuditLog_action_idx`(`action`),
  INDEX `CandidateAuditLog_performedById_idx`(`performedById`),
  INDEX `CandidateAuditLog_createdAt_idx`(`createdAt`),
  CONSTRAINT `CandidateAuditLog_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CandidateAuditLog_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
