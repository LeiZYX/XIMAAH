-- System Student ID (STU-YYYY-000001) and lifecycle audit actions

CREATE TABLE `StudentIdSequence` (
  `year` INT NOT NULL,
  `lastNumber` INT NOT NULL,
  PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Candidate`
  ADD COLUMN `studentId` VARCHAR(191) NULL;

-- Backfill by creation year, ordered oldest first within each year
SET @row_num := 0;
SET @current_year := 0;

UPDATE `Candidate` c
JOIN (
  SELECT
    id,
    YEAR(`createdAt`) AS seq_year,
    @row_num := IF(@current_year = YEAR(`createdAt`), @row_num + 1, 1) AS seq_num,
    @current_year := YEAR(`createdAt`) AS _set_year
  FROM `Candidate`
  WHERE `studentId` IS NULL
  ORDER BY YEAR(`createdAt`), `createdAt`, `id`
) ordered ON ordered.id = c.id
SET c.`studentId` = CONCAT(
  'STU-',
  ordered.seq_year,
  '-',
  LPAD(ordered.seq_num, 6, '0')
)
WHERE c.`studentId` IS NULL;

INSERT INTO `StudentIdSequence` (`year`, `lastNumber`)
SELECT YEAR(`createdAt`) AS y, MAX(CAST(SUBSTRING_INDEX(`studentId`, '-', -1) AS UNSIGNED)) AS lastNumber
FROM `Candidate`
WHERE `studentId` IS NOT NULL
GROUP BY YEAR(`createdAt`)
ON DUPLICATE KEY UPDATE `lastNumber` = GREATEST(`StudentIdSequence`.`lastNumber`, VALUES(`lastNumber`));

ALTER TABLE `Candidate`
  MODIFY `studentId` VARCHAR(191) NOT NULL,
  ADD UNIQUE INDEX `Candidate_studentId_key`(`studentId`);

CREATE INDEX `Candidate_studentId_idx` ON `Candidate`(`studentId`);

-- UserAuditAction enum extensions
ALTER TABLE `UserAuditLog` MODIFY `action` ENUM(
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_FORCE_SET_BY_ADMIN',
  'STUDENT_IMPORTED',
  'TEACHER_IMPORTED',
  'STUDENT_PROMOTED',
  'STUDENT_ARCHIVED',
  'STUDENT_REACTIVATED',
  'STUDENT_DELETED'
) NOT NULL;
