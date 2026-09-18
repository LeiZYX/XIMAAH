-- Distinguish how a fee statement became PAID (online / offline / covered by prior payments).

ALTER TABLE `FeeStatement`
  ADD COLUMN `paymentSettlement` ENUM('NONE', 'ONLINE', 'OFFLINE', 'COVERED') NOT NULL DEFAULT 'NONE';

-- Online: successful GlobePay / QR payment order on this statement
UPDATE `FeeStatement` fs
SET fs.`paymentSettlement` = 'ONLINE'
WHERE fs.`status` = 'PAID'
  AND EXISTS (
    SELECT 1
    FROM `PaymentOrder` po
    WHERE po.`feeStatementId` = fs.`id`
      AND po.`status` = 'PAID'
  );

-- Offline: staff marked paid (cash-in or future fee-statements batch)
UPDATE `FeeStatement` fs
SET fs.`paymentSettlement` = 'OFFLINE'
WHERE fs.`status` = 'PAID'
  AND fs.`paymentSettlement` = 'NONE'
  AND (
    fs.`paymentNotes` LIKE '%Marked paid offline%'
    OR fs.`paymentNotes` LIKE '%Offline payment recorded%'
    OR EXISTS (
      SELECT 1
      FROM `FeeAuditLog` fal
      WHERE fal.`action` = 'FEE_STATEMENT_MARKED_PAID_OFFLINE'
        AND fal.`metadata` IS NOT NULL
        AND fal.`metadata` LIKE CONCAT('%', fs.`id`, '%')
    )
  );

-- Remaining PAID rows (typically zero-due / covered by prior payments)
UPDATE `FeeStatement` fs
SET fs.`paymentSettlement` = 'COVERED'
WHERE fs.`status` = 'PAID'
  AND fs.`paymentSettlement` = 'NONE';
