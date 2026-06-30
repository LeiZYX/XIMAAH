import type {
  PostResultServiceType,
  ReviewRequestStatus,
  ReviewWindowStatus,
} from "@/generated/prisma";

export const REVIEW_WINDOW_STATUS_OPTIONS: {
  value: ReviewWindowStatus;
  label: string;
}[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "LOCKED", label: "Locked" },
];

export const REVIEW_WINDOW_SERVICE_OPTIONS: {
  value: PostResultServiceType;
  label: string;
  configurable: boolean;
}[] = [
  { value: "REVIEW", label: "Review", configurable: true },
  { value: "PRIORITY_REVIEW", label: "Priority Review", configurable: true },
  { value: "CLERICAL_CHECK", label: "Clerical Check", configurable: true },
  { value: "ACCESS_TO_SCRIPT", label: "Access to Script", configurable: true },
  { value: "CASH_IN", label: "Cash-in", configurable: true },
  { value: "CERTIFICATE", label: "Certificate", configurable: true },
  { value: "ADMINISTRATIVE", label: "Administrative", configurable: false },
];

export const CONFIGURABLE_REVIEW_SERVICES = REVIEW_WINDOW_SERVICE_OPTIONS.filter(
  (option) => option.configurable,
).map((option) => option.value);

export const REVIEW_REQUEST_STATUS_OPTIONS: {
  value: ReviewRequestStatus;
  label: string;
}[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "SENT_TO_BOARD", label: "Sent to Board" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function reviewWindowStatusLabel(status: ReviewWindowStatus | string): string {
  return REVIEW_WINDOW_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function postResultServiceLabel(serviceType: PostResultServiceType | string): string {
  return (
    REVIEW_WINDOW_SERVICE_OPTIONS.find((option) => option.value === serviceType)?.label ??
    serviceType
  );
}

export function reviewRequestStatusLabel(status: ReviewRequestStatus | string): string {
  return REVIEW_REQUEST_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}
