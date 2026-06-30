-- Align RegistrationAuditLog.billingScope with RegistrationWorkspace / Prisma BillingScope enum

ALTER TABLE `RegistrationAuditLog` MODIFY `billingScope` ENUM(
  'NORMAL_BILLING',
  'OFFICE_ONLY_BILLING',
  'NO_BILLING',
  'MANUAL_REVIEW',
  'RESTRICTED_BILLING',
  'EXTERNAL_BILLING'
) NULL;

UPDATE `RegistrationAuditLog`
SET `billingScope` = 'RESTRICTED_BILLING'
WHERE `billingScope` = 'OFFICE_ONLY_BILLING';

ALTER TABLE `RegistrationAuditLog` MODIFY `billingScope` ENUM(
  'NORMAL_BILLING',
  'RESTRICTED_BILLING',
  'EXTERNAL_BILLING',
  'NO_BILLING',
  'MANUAL_REVIEW'
) NULL;
