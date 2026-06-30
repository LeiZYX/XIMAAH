-- Legacy unique indexes were already removed in a prior partial apply.
-- Create type-scoped uniques so Normal and Restricted workspaces can coexist per window.
CREATE UNIQUE INDEX `rw_candidate_window_type_uq` ON `RegistrationWorkspace`(`candidateId`, `registrationWindowId`, `registrationType`);
CREATE UNIQUE INDEX `rw_student_window_type_uq` ON `RegistrationWorkspace`(`studentId`, `registrationWindowId`, `registrationType`);
