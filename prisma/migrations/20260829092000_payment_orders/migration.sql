CREATE TABLE `PaymentOrder` (
    `id` VARCHAR(191) NOT NULL,
    `feeStatementId` VARCHAR(191) NOT NULL,
    `partnerOrderId` VARCHAR(191) NOT NULL,
    `channel` ENUM('Wechat', 'Alipay') NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
    `amountMinor` INTEGER NOT NULL,
    `amountGbp` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('CREATED', 'PAYING', 'PAID', 'CLOSED', 'FAILED') NOT NULL DEFAULT 'CREATED',
    `description` VARCHAR(191) NOT NULL,
    `codeUrl` TEXT NULL,
    `qrcodeImg` LONGTEXT NULL,
    `payUrl` TEXT NULL,
    `globepayOrderId` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `notifyPayload` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentOrder_partnerOrderId_key`(`partnerOrderId`),
    INDEX `PaymentOrder_feeStatementId_idx`(`feeStatementId`),
    INDEX `PaymentOrder_status_idx`(`status`),
    UNIQUE INDEX `PaymentOrder_feeStatementId_channel_version_key`(`feeStatementId`, `channel`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PaymentOrder`
  ADD CONSTRAINT `PaymentOrder_feeStatementId_fkey`
  FOREIGN KEY (`feeStatementId`) REFERENCES `FeeStatement`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
