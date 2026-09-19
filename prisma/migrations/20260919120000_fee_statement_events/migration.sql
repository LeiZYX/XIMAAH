-- Per-statement activity timeline (generated, orders, paid online/offline, revisions).

CREATE TABLE `FeeStatementEvent` (
  `id` VARCHAR(191) NOT NULL,
  `feeStatementId` VARCHAR(191) NOT NULL,
  `paymentOrderId` VARCHAR(191) NULL,
  `kind` ENUM(
    'GENERATED',
    'ISSUED',
    'COVERED',
    'ORDER_CREATED',
    'ORDER_CANCELLED',
    'ORDER_CLOSED',
    'PAID_ONLINE',
    'MARKED_PAID_OFFLINE',
    'NEEDS_REGENERATION',
    'REGENERATED',
    'REPRICED',
    'SUPERSEDED'
  ) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `actorUserId` VARCHAR(191) NULL,
  `summary` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `FeeStatementEvent_feeStatementId_occurredAt_idx`(`feeStatementId`, `occurredAt`),
  INDEX `FeeStatementEvent_actorUserId_idx`(`actorUserId`),
  INDEX `FeeStatementEvent_paymentOrderId_idx`(`paymentOrderId`),
  INDEX `FeeStatementEvent_kind_idx`(`kind`),
  CONSTRAINT `FeeStatementEvent_feeStatementId_fkey`
    FOREIGN KEY (`feeStatementId`) REFERENCES `FeeStatement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FeeStatementEvent_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `kind`, `occurredAt`, `actorUserId`, `summary`)
SELECT UUID(), fs.`id`, 'GENERATED', fs.`generatedAt`, fs.`generatedByUserId`,
  CONCAT('Generated ', fs.`statementNo`)
FROM `FeeStatement` fs;

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `kind`, `occurredAt`, `actorUserId`, `summary`)
SELECT UUID(), fs.`id`, 'ISSUED', fs.`issuedAt`, fs.`generatedByUserId`,
  CONCAT('Issued ', fs.`statementNo`)
FROM `FeeStatement` fs
WHERE fs.`issuedAt` IS NOT NULL
  AND fs.`paymentSettlement` <> 'COVERED';

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `kind`, `occurredAt`, `actorUserId`, `summary`)
SELECT UUID(), fs.`id`, 'COVERED', COALESCE(fs.`issuedAt`, fs.`generatedAt`), fs.`generatedByUserId`,
  CONCAT('No balance due. ', fs.`statementNo`, ' marked Paid · Covered')
FROM `FeeStatement` fs
WHERE fs.`paymentSettlement` = 'COVERED';

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `paymentOrderId`, `kind`, `occurredAt`, `summary`)
SELECT UUID(), po.`feeStatementId`, po.`id`, 'ORDER_CREATED', po.`createdAt`,
  CONCAT('Created ', po.`channel`, ' order ', po.`partnerOrderId`, ' for £', po.`amountGbp`)
FROM `PaymentOrder` po;

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `paymentOrderId`, `kind`, `occurredAt`, `summary`)
SELECT UUID(), po.`feeStatementId`, po.`id`, 'PAID_ONLINE', COALESCE(po.`paidAt`, po.`updatedAt`),
  CONCAT(
    'Paid via ', po.`channel`,
    ' / ', po.`partnerOrderId`,
    IF(po.`globepayOrderId` IS NULL, '', CONCAT(' (GlobePay ', po.`globepayOrderId`, ')'))
  )
FROM `PaymentOrder` po
WHERE po.`status` = 'PAID';

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `paymentOrderId`, `kind`, `occurredAt`, `actorUserId`, `summary`)
SELECT UUID(), po.`feeStatementId`, po.`id`, 'ORDER_CANCELLED', COALESCE(po.`cancelledAt`, po.`updatedAt`),
  po.`cancelledByUserId`,
  CONCAT('Cancelled ', po.`channel`, ' order ', po.`partnerOrderId`)
FROM `PaymentOrder` po
WHERE po.`status` = 'CANCELLED';

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `paymentOrderId`, `kind`, `occurredAt`, `summary`)
SELECT UUID(), po.`feeStatementId`, po.`id`, 'ORDER_CLOSED', po.`updatedAt`,
  CONCAT('Closed ', po.`channel`, ' order ', po.`partnerOrderId`)
FROM `PaymentOrder` po
WHERE po.`status` = 'CLOSED';

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `kind`, `occurredAt`, `actorUserId`, `summary`)
SELECT UUID(), fs.`id`, 'MARKED_PAID_OFFLINE', fal.`performedAt`, fal.`performedByUserId`,
  COALESCE(fal.`note`, CONCAT('Marked ', fs.`statementNo`, ' paid offline'))
FROM `FeeAuditLog` fal
INNER JOIN `FeeStatement` fs
  ON fs.`id` = JSON_UNQUOTE(JSON_EXTRACT(fal.`metadata`, '$.feeStatementId'))
WHERE fal.`action` = 'FEE_STATEMENT_MARKED_PAID_OFFLINE'
  AND JSON_VALID(fal.`metadata`);

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `kind`, `occurredAt`, `actorUserId`, `summary`)
SELECT UUID(), fs.`id`, 'MARKED_PAID_OFFLINE', fs.`updatedAt`, fs.`generatedByUserId`,
  CONCAT('Marked ', fs.`statementNo`, ' paid offline (backfilled)')
FROM `FeeStatement` fs
WHERE fs.`paymentSettlement` = 'OFFLINE'
  AND NOT EXISTS (
    SELECT 1 FROM `FeeStatementEvent` ev
    WHERE ev.`feeStatementId` = fs.`id` AND ev.`kind` = 'MARKED_PAID_OFFLINE'
  );

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `kind`, `occurredAt`, `actorUserId`, `summary`)
SELECT UUID(), fs.`id`, 'NEEDS_REGENERATION', fs.`regenerationChangedAt`, fs.`regenerationChangedByUserId`,
  COALESCE(fs.`regenerationReason`, CONCAT(fs.`statementNo`, ' needs regeneration'))
FROM `FeeStatement` fs
WHERE fs.`status` = 'NEEDS_REGENERATION'
  AND fs.`regenerationChangedAt` IS NOT NULL;

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `kind`, `occurredAt`, `actorUserId`, `summary`)
SELECT UUID(), fs.`id`, 'REGENERATED', fs.`generatedAt`, fs.`generatedByUserId`,
  CONCAT('Regenerated revised statement ', fs.`statementNo`)
FROM `FeeStatement` fs
WHERE fs.`revisedFromStatementId` IS NOT NULL;

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `kind`, `occurredAt`, `actorUserId`, `summary`)
SELECT UUID(), fs.`id`, 'REPRICED', fal.`performedAt`, fal.`performedByUserId`,
  COALESCE(fal.`note`, CONCAT('Repriced ', fs.`statementNo`, ' by current fee stage'))
FROM `FeeAuditLog` fal
INNER JOIN `FeeStatement` fs
  ON fs.`id` = JSON_UNQUOTE(JSON_EXTRACT(fal.`metadata`, '$.statementId'))
WHERE fal.`action` = 'FEE_STATEMENT_REPRICED_BY_CURRENT_STAGE'
  AND JSON_VALID(fal.`metadata`);

INSERT INTO `FeeStatementEvent` (`id`, `feeStatementId`, `kind`, `occurredAt`, `actorUserId`, `summary`)
SELECT UUID(), fs.`id`, 'SUPERSEDED', fs.`updatedAt`, COALESCE(fs.`regenerationChangedByUserId`, fs.`generatedByUserId`),
  CONCAT(fs.`statementNo`, ' superseded by a revised statement')
FROM `FeeStatement` fs
WHERE fs.`status` = 'REVISED';
