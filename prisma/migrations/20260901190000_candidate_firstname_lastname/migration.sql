-- Candidate legal Firstname / Lastname for exam-board exports (internal + external)

ALTER TABLE `Candidate`
  ADD COLUMN `firstName` VARCHAR(191) NULL,
  ADD COLUMN `lastName` VARCHAR(191) NULL;

-- Best-effort backfill from legalEnglishName / englishName (first token = firstName, rest = lastName)
UPDATE `Candidate`
SET
  `firstName` = UPPER(TRIM(SUBSTRING_INDEX(COALESCE(NULLIF(`legalEnglishName`, ''), `englishName`), ' ', 1))),
  `lastName` = UPPER(
    TRIM(
      CASE
        WHEN LOCATE(' ', COALESCE(NULLIF(`legalEnglishName`, ''), `englishName`)) > 0
          THEN SUBSTRING(
            COALESCE(NULLIF(`legalEnglishName`, ''), `englishName`),
            LOCATE(' ', COALESCE(NULLIF(`legalEnglishName`, ''), `englishName`)) + 1
          )
        ELSE ''
      END
    )
  )
WHERE
  (`firstName` IS NULL OR `firstName` = '')
  AND COALESCE(NULLIF(`legalEnglishName`, ''), `englishName`) IS NOT NULL
  AND TRIM(COALESCE(NULLIF(`legalEnglishName`, ''), `englishName`)) <> '';
