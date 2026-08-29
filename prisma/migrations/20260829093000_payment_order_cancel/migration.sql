-- Add CANCELLED status and cancel audit fields to PaymentOrder

ALTER TABLE `PaymentOrder`
  MODIFY `status` ENUM('CREATED', 'PAYING', 'PAID', 'CLOSED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'CREATED';

ALTER TABLE `PaymentOrder`
  ADD COLUMN `cancelledAt` DATETIME(3) NULL,
  ADD COLUMN `cancelledByUserId` VARCHAR(191) NULL,
  ADD COLUMN `cancelNote` TEXT NULL;

CREATE INDEX `PaymentOrder_cancelledByUserId_idx` ON `PaymentOrder`(`cancelledByUserId`);

ALTER TABLE `PaymentOrder`
  ADD CONSTRAINT `PaymentOrder_cancelledByUserId_fkey`
  FOREIGN KEY (`cancelledByUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
