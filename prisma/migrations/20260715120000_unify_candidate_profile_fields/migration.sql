-- Grade enum + Gender UNKNOWN; normalize grade columns on StudentProfile and Candidate

-- Gender: add UNKNOWN
ALTER TABLE `StudentProfile` MODIFY `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'UNKNOWN', 'PREFER_NOT_TO_SAY') NULL;
ALTER TABLE `Candidate` MODIFY `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'UNKNOWN', 'PREFER_NOT_TO_SAY') NULL;

-- Normalize StudentProfile.currentGrade strings before enum conversion
UPDATE `StudentProfile` SET `currentGrade` = 'G9' WHERE UPPER(TRIM(`currentGrade`)) IN ('9', 'Y9', 'YEAR9', 'GRADE9', 'G9');
UPDATE `StudentProfile` SET `currentGrade` = 'G10' WHERE UPPER(TRIM(`currentGrade`)) IN ('10', 'Y10', 'YEAR10', 'GRADE10', 'G10');
UPDATE `StudentProfile` SET `currentGrade` = 'G11' WHERE UPPER(TRIM(`currentGrade`)) IN ('11', 'Y11', 'YEAR11', 'GRADE11', 'G11');
UPDATE `StudentProfile` SET `currentGrade` = 'G12' WHERE UPPER(TRIM(`currentGrade`)) IN ('12', 'Y12', 'YEAR12', 'GRADE12', 'G12');
UPDATE `StudentProfile` SET `currentGrade` = 'G9' WHERE `currentGrade` NOT IN ('G9', 'G10', 'G11', 'G12');

ALTER TABLE `StudentProfile` MODIFY `currentGrade` ENUM('G9', 'G10', 'G11', 'G12') NOT NULL;

-- Normalize Candidate.grade
UPDATE `Candidate` SET `grade` = 'G9' WHERE UPPER(TRIM(`grade`)) IN ('9', 'Y9', 'YEAR9', 'GRADE9', 'G9');
UPDATE `Candidate` SET `grade` = 'G10' WHERE UPPER(TRIM(`grade`)) IN ('10', 'Y10', 'YEAR10', 'GRADE10', 'G10');
UPDATE `Candidate` SET `grade` = 'G11' WHERE UPPER(TRIM(`grade`)) IN ('11', 'Y11', 'YEAR11', 'GRADE11', 'G11');
UPDATE `Candidate` SET `grade` = 'G12' WHERE UPPER(TRIM(`grade`)) IN ('12', 'Y12', 'YEAR12', 'GRADE12', 'G12');
UPDATE `Candidate` SET `grade` = NULL WHERE `grade` IS NOT NULL AND `grade` NOT IN ('G9', 'G10', 'G11', 'G12');

ALTER TABLE `Candidate` MODIFY `grade` ENUM('G9', 'G10', 'G11', 'G12') NULL;

-- Matching indexes for internal student import
CREATE INDEX `Candidate_email_idx` ON `Candidate`(`email`);
CREATE INDEX `Candidate_phone_idx` ON `Candidate`(`phone`);
CREATE INDEX `Candidate_idNumber_idx` ON `Candidate`(`idNumber`);
CREATE INDEX `Candidate_passportNumber_idx` ON `Candidate`(`passportNumber`);
