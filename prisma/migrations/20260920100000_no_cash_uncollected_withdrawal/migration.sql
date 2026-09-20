-- Track B: subject removed with nothing collected is not a cash refund.
-- History can show SUBJECT_REMOVED on fee statements.

ALTER TABLE `FeeStatementEvent`
  MODIFY COLUMN `kind` ENUM(
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
    'SUPERSEDED',
    'REFUND_RECORDED',
    'SUBJECT_REMOVED'
  ) NOT NULL;

ALTER TABLE `OfflineWithdrawalRefund`
  MODIFY COLUMN `status` ENUM(
    'PENDING_OFFLINE',
    'COMPLETED',
    'ZERO_NO_REFUND',
    'NO_CASH_UNCOLLECTED'
  ) NOT NULL DEFAULT 'PENDING_OFFLINE';

-- Pending cash refunds where the workspace never collected money become no-cash rows.
UPDATE `OfflineWithdrawalRefund` owr
LEFT JOIN (
  SELECT DISTINCT fs.`registrationWorkspaceId` AS wid
  FROM `FeeStatement` fs
  INNER JOIN `PaymentOrder` po
    ON po.`feeStatementId` = fs.`id` AND po.`status` = 'PAID'
  WHERE fs.`registrationWorkspaceId` IS NOT NULL
) paid ON paid.wid = owr.`registrationWorkspaceId`
LEFT JOIN (
  SELECT DISTINCT `registrationWorkspaceId` AS wid
  FROM `FeeStatement`
  WHERE `paymentSettlement` = 'OFFLINE'
    AND `registrationWorkspaceId` IS NOT NULL
) offp ON offp.wid = owr.`registrationWorkspaceId`
SET owr.`status` = 'NO_CASH_UNCOLLECTED'
WHERE owr.`status` = 'PENDING_OFFLINE'
  AND paid.wid IS NULL
  AND offp.wid IS NULL;
