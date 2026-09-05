-- Edexcel Internal: snapshot UCI at first subject add; track system-allocated provisional UCI.
ALTER TABLE `RegistrationWorkspace`
  ADD COLUMN `uciAtEntry` VARCHAR(191) NULL,
  ADD COLUMN `uciEntrySnapshotCaptured` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `uciAllocatedBySystem` BOOLEAN NOT NULL DEFAULT false;
