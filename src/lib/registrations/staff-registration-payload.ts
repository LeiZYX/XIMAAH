import type {
  BillingScope,
  RegistrationSource,
  RegistrationType,
  RegistrationVisibility,
} from "@/generated/prisma/enums";
import { RegistrationError } from "@/lib/registrations/errors";

const REGISTRATION_TYPES = new Set<RegistrationType>([
  "INTERNAL_NORMAL",
  "RESTRICTED_INTERNAL",
  "EXTERNAL",
]);

const BILLING_SCOPES = new Set<BillingScope>([
  "NORMAL_BILLING",
  "RESTRICTED_BILLING",
  "EXTERNAL_BILLING",
  "NO_BILLING",
  "MANUAL_REVIEW",
]);

const VISIBILITIES = new Set<RegistrationVisibility>([
  "STUDENT_AND_TEACHER",
  "STUDENT_ONLY",
  "EXAM_OFFICE_ONLY",
]);

const REGISTRATION_SOURCES = new Set<RegistrationSource>([
  "STUDENT_SUBMITTED",
  "EO_ASSISTED",
  "ADMIN_ASSISTED",
  "EO_FORCED_INTERNAL",
  "ADMIN_FORCED_INTERNAL",
  "EXTERNAL_CANDIDATE",
  "EO_POST_LOCK_ADJUSTMENT",
  "ADMIN_POST_LOCK_ADJUSTMENT",
]);

function assertEnumValue<T extends string>(
  field: string,
  value: unknown,
  allowed: Set<T>,
): T | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new RegistrationError(`Invalid ${field}: ${String(value)}`, 400);
  }
  return value as T;
}

export interface StaffRegistrationMetadataInput {
  registrationType?: string;
  billingScope?: string;
  visibility?: string;
  registrationSource?: string;
}

export function parseStaffRegistrationMetadata(
  data: StaffRegistrationMetadataInput,
): {
  registrationType?: RegistrationType;
  billingScope?: BillingScope;
  visibility?: RegistrationVisibility;
  registrationSource?: RegistrationSource;
} {
  return {
    registrationType: assertEnumValue("registrationType", data.registrationType, REGISTRATION_TYPES),
    billingScope: assertEnumValue("billingScope", data.billingScope, BILLING_SCOPES),
    visibility: assertEnumValue("visibility", data.visibility, VISIBILITIES),
    registrationSource: assertEnumValue(
      "registrationSource",
      data.registrationSource,
      REGISTRATION_SOURCES,
    ),
  };
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof RegistrationError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not submit registration";
}
