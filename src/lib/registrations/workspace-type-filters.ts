import type { RegistrationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { registrationTypeBadgeLabel } from "@/lib/registrations/registration-type";

export const STAFF_REGISTRATION_TYPE_FILTERS = [
  "INTERNAL_NORMAL",
  "RESTRICTED_INTERNAL",
  "EXTERNAL",
] as const;

export type StaffRegistrationTypeFilter = (typeof STAFF_REGISTRATION_TYPE_FILTERS)[number];

export const DEFAULT_STAFF_REGISTRATION_TYPES: StaffRegistrationTypeFilter[] = [
  ...STAFF_REGISTRATION_TYPE_FILTERS,
];

export const REGISTRATION_TYPE_FILTER_LABELS: Record<StaffRegistrationTypeFilter, string> = {
  INTERNAL_NORMAL: "Internal normal",
  RESTRICTED_INTERNAL: "Restricted internal",
  EXTERNAL: "External",
};

export function isStaffRegistrationTypeFilter(value: string): value is StaffRegistrationTypeFilter {
  return (STAFF_REGISTRATION_TYPE_FILTERS as readonly string[]).includes(value);
}

export function parseStaffRegistrationType(
  searchParams: URLSearchParams,
): StaffRegistrationTypeFilter {
  const raw = searchParams.get("type");
  if (raw && isStaffRegistrationTypeFilter(raw)) return raw;
  return "INTERNAL_NORMAL";
}

export function parseStaffRegistrationTypes(searchParams: URLSearchParams): StaffRegistrationTypeFilter[] {
  const raw = searchParams.get("registrationTypes");
  if (!raw) return [...DEFAULT_STAFF_REGISTRATION_TYPES];
  const parsed = raw
    .split(",")
    .map((part) => part.trim())
    .filter(isStaffRegistrationTypeFilter);
  return parsed.length > 0 ? parsed : [...DEFAULT_STAFF_REGISTRATION_TYPES];
}

export function serializeStaffRegistrationTypes(types: StaffRegistrationTypeFilter[]): string {
  return types.join(",");
}

export function buildWorkspaceRegistrationTypeWhere(
  types: StaffRegistrationTypeFilter[],
): Prisma.RegistrationWorkspaceWhereInput {
  if (types.length === 0) return {};
  return {
    registrationType: { in: types as RegistrationType[] },
  };
}

export function registrationTypeFilterDescription(types: StaffRegistrationTypeFilter[]): string {
  if (types.length === STAFF_REGISTRATION_TYPE_FILTERS.length) return "All registration types";
  if (types.length === 1) {
    switch (types[0]) {
      case "INTERNAL_NORMAL":
        return "Internal normal only";
      case "RESTRICTED_INTERNAL":
        return "Restricted internal only";
      case "EXTERNAL":
        return "External only";
    }
  }
  return types.map((type) => REGISTRATION_TYPE_FILTER_LABELS[type]).join(", ");
}

export function registrationTypeBadgeClass(type: string): string {
  switch (type) {
    case "RESTRICTED_INTERNAL":
      return "bg-amber-100 text-amber-900";
    case "EXTERNAL":
      return "bg-purple-100 text-purple-900";
    default:
      return "bg-emerald-100 text-emerald-800";
  }
}

export { registrationTypeBadgeLabel };

export function includesInternalNormal(types: StaffRegistrationTypeFilter[]): boolean {
  return types.includes("INTERNAL_NORMAL");
}

export function includesRestrictedInternal(types: StaffRegistrationTypeFilter[]): boolean {
  return types.includes("RESTRICTED_INTERNAL");
}

export function includesExternal(types: StaffRegistrationTypeFilter[]): boolean {
  return types.includes("EXTERNAL");
}

export function primaryRegistrationTypeFilter(
  types: StaffRegistrationTypeFilter[],
): StaffRegistrationTypeFilter {
  if (types.length === 1) return types[0]!;
  return "INTERNAL_NORMAL";
}

export const REGISTRATION_TYPE_MENU_LABELS = {
  INTERNAL_NORMAL: "Internal / Normal",
  RESTRICTED_INTERNAL: "Restricted internal",
  EXTERNAL: "External",
} as const;

export const FEE_STATEMENT_TYPE_RADIO_LABELS: Record<StaffRegistrationTypeFilter, string> = {
  INTERNAL_NORMAL: "Internal normal (FS-IN)",
  RESTRICTED_INTERNAL: "Restricted internal (FS-RI)",
  EXTERNAL: "External candidate (FS-EX)",
};

export function parseFeeStatementType(searchParams: URLSearchParams): StaffRegistrationTypeFilter {
  const raw = searchParams.get("statementType");
  if (raw && isStaffRegistrationTypeFilter(raw)) return raw;
  return "INTERNAL_NORMAL";
}

export type WorkspaceTableView = "normal" | "restricted" | "external" | "mixed";

export function resolveWorkspaceTableView(
  types: StaffRegistrationTypeFilter[],
): WorkspaceTableView {
  if (types.length === 1) {
    switch (types[0]) {
      case "RESTRICTED_INTERNAL":
        return "restricted";
      case "EXTERNAL":
        return "external";
      default:
        return "normal";
    }
  }
  return "mixed";
}

export function workspaceListTitle(types: StaffRegistrationTypeFilter[]): string {
  const view = resolveWorkspaceTableView(types);
  switch (view) {
    case "restricted":
      return "Restricted internal registrations";
    case "external":
      return "External candidate registrations";
    case "mixed":
      return "All registration workspaces";
    default:
      return "Internal normal registrations";
  }
}

export function workspaceListDescription(types: StaffRegistrationTypeFilter[]): string {
  const view = resolveWorkspaceTableView(types);
  switch (view) {
    case "restricted":
      return "Office-only registrations hidden from students and teachers. Billed on FS-RI statements.";
    case "external":
      return "External candidate registrations with no student portal access. Billed on FS-EX statements.";
    case "mixed":
      return registrationTypeFilterDescription(types);
    default:
      return "Student-visible internal registrations, including assisted and post-lock adjustments. Billed on FS-IN statements.";
  }
}

export const includesNormalRegistrations = includesInternalNormal;
