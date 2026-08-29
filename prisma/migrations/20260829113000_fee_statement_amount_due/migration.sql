ALTER TABLE `FeeStatement`
  ADD COLUMN `previouslyPaidGbpAmount` DECIMAL(12, 2) NULL,
  ADD COLUMN `previouslyPaidCnyAmount` DECIMAL(12, 2) NULL,
  ADD COLUMN `amountDueGbpAmount` DECIMAL(12, 2) NULL,
  ADD COLUMN `amountDueCnyAmount` DECIMAL(12, 2) NULL;
