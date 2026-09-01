-- Scheme A: Firstname ≡ Pinyin First, Lastname ≡ Pinyin Last.
-- Move mis-backfilled English nicknames into preferredEnglishName, then sync board names from pinyin.

UPDATE `Candidate`
SET
  `preferredEnglishName` = TRIM(`firstName`)
WHERE
  (`preferredEnglishName` IS NULL OR TRIM(`preferredEnglishName`) = '')
  AND `firstName` IS NOT NULL
  AND TRIM(`firstName`) <> ''
  AND `givenNamePinyin` IS NOT NULL
  AND TRIM(`givenNamePinyin`) <> ''
  AND UPPER(TRIM(`firstName`)) <> UPPER(TRIM(`givenNamePinyin`));

UPDATE `Candidate`
SET
  `firstName` = TRIM(`givenNamePinyin`),
  `lastName` = TRIM(`surnamePinyin`)
WHERE
  `givenNamePinyin` IS NOT NULL
  AND TRIM(`givenNamePinyin`) <> ''
  AND `surnamePinyin` IS NOT NULL
  AND TRIM(`surnamePinyin`) <> '';

UPDATE `Candidate`
SET
  `givenNamePinyin` = TRIM(`firstName`),
  `surnamePinyin` = TRIM(`lastName`)
WHERE
  (`givenNamePinyin` IS NULL OR TRIM(`givenNamePinyin`) = '' OR `surnamePinyin` IS NULL OR TRIM(`surnamePinyin`) = '')
  AND `firstName` IS NOT NULL
  AND TRIM(`firstName`) <> ''
  AND `lastName` IS NOT NULL
  AND TRIM(`lastName`) <> '';

UPDATE `Candidate`
SET
  `legalEnglishName` = TRIM(CONCAT(TRIM(`firstName`), ' ', TRIM(`lastName`))),
  `englishName` = CASE
    WHEN `preferredEnglishName` IS NOT NULL AND TRIM(`preferredEnglishName`) <> ''
      THEN TRIM(`preferredEnglishName`)
    ELSE TRIM(CONCAT(TRIM(`firstName`), ' ', TRIM(`lastName`)))
  END
WHERE
  `firstName` IS NOT NULL
  AND TRIM(`firstName`) <> ''
  AND `lastName` IS NOT NULL
  AND TRIM(`lastName`) <> '';
