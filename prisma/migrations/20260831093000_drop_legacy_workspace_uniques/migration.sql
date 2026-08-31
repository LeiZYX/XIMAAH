-- Remove pre-registration-type workspace uniques.
-- Normal and Restricted workspaces may coexist for the same candidate/window.
DROP INDEX `RegistrationWorkspace_candidateId_registrationWindowId_key` ON `RegistrationWorkspace`;
DROP INDEX `RegistrationWorkspace_studentId_registrationWindowId_key` ON `RegistrationWorkspace`;
