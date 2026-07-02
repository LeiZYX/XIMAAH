-- Optional cleanup: remove empty registration workspaces left by failed submit attempts
-- (workspace created outside transaction, but no registration items attached).
-- Review counts before uncommenting DELETE.

SELECT
  rw.id,
  rw.registrationNumber,
  rw.registrationType,
  rw.createdAt,
  COUNT(ser.id) AS registration_item_count
FROM RegistrationWorkspace rw
LEFT JOIN StudentExamRegistration ser
  ON ser.registrationWorkspaceId = rw.id
  AND ser.status IN ('ACTIVE', 'LOCKED')
GROUP BY rw.id, rw.registrationNumber, rw.registrationType, rw.createdAt
HAVING registration_item_count = 0
ORDER BY rw.createdAt DESC;

-- Uncomment to delete orphan workspaces (no active/locked registration items):
-- DELETE rw FROM RegistrationWorkspace rw
-- LEFT JOIN StudentExamRegistration ser
--   ON ser.registrationWorkspaceId = rw.id
--   AND ser.status IN ('ACTIVE', 'LOCKED')
-- WHERE ser.id IS NULL;
