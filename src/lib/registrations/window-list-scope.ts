import type { Prisma } from "@/generated/prisma";

export type RegistrationWindowListScope =
  | "staff"
  | "student"
  | "teacher"
  | "assisted"
  | "office-only"
  | "external"
  | "late-teacher"
  | "late-staff";

export function registrationWindowScopeWhere(
  scope: RegistrationWindowListScope | null | undefined,
): Prisma.RegistrationWindowWhereInput {
  switch (scope) {
    case "student":
      return {
        status: "OPEN",
        studentSelfRegistrationEnabled: true,
      };
    case "teacher":
      return {
        status: { in: ["OPEN", "CLOSED"] },
      };
    case "assisted":
      return {
        status: "OPEN",
        eoAssistedRegistrationEnabled: true,
      };
    case "office-only":
      return {
        status: { not: "DRAFT" },
        officeOnlyRegistrationEnabled: true,
      };
    case "external":
      return {
        status: { not: "DRAFT" },
      };
    case "late-teacher":
      return {
        status: "OPEN",
      };
    case "late-staff":
      return {
        status: { in: ["OPEN", "CLOSED"] },
      };
    case "staff":
    default:
      return {};
  }
}

export function parseRegistrationWindowListScope(
  value: string | null | undefined,
): RegistrationWindowListScope | undefined {
  const scopes: RegistrationWindowListScope[] = [
    "staff",
    "student",
    "teacher",
    "assisted",
    "office-only",
    "external",
    "late-teacher",
    "late-staff",
  ];
  if (value && scopes.includes(value as RegistrationWindowListScope)) {
    return value as RegistrationWindowListScope;
  }
  return undefined;
}
