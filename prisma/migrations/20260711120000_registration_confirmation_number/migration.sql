-- AlterTable
ALTER TABLE `RegistrationWorkspace` ADD COLUMN `confirmationNumber` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `RegistrationWorkspace_confirmationNumber_key` ON `RegistrationWorkspace`(`confirmationNumber`);
