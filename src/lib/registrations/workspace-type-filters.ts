import type { RegistrationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const STAFF_REGISTRATION_TYPE_FILTERS = ["NORMAL", "RESTRICTED", "EXTERNAL"] as const;
export type StaffRegistrationTypeFilter = (typeof STAFF_REGISTRATION_TYPE_FILTERS)[number];

export const DEFAULT_STAFF_REGISTRATION_TYPES: StaffRegistrationTypeFilter[] = ["NORMAL"];

export const REGISTRATION_TYPE_FILTER_LABELS: Record<StaffRegistrationTypeFilter, string> = {
  NORMAL: "Normal/Internal Student",
  RESTRICTED: "Restricted",
  EXTERNAL: "External Candidate",
};

export function isStaffRegistrationTypeFilter(
  value: string,
): value is StaffRegistrationTypeFilter {
  return STAFF_REGISTRATION_TYPE_FILTERS.includes(value as StaffRegistrationTypeFilter);
}

export function parseStaffRegistrationTypes(
  searchParams: URLSearchParams,
): StaffRegistrationTypeFilter[] {
  const raw = searchParams.get("registrationTypes");
  if (!raw) return [...DEFAULT_STAFF_REGISTRATION_TYPES];
  const types = raw
    .split(",")
    .map((part) => part.trim())
    .filter(isStaffRegistrationTypeFilter);
  return types.length > 0 ? types : [...DEFAULT_STAFF_REGISTRATION_TYPES];
}

export function serializeStaffRegistrationTypes(types: StaffRegistrationTypeFilter[]): string {
  return types.join(",");
}

export function buildWorkspaceRegistrationTypeWhere(
  types: StaffRegistrationTypeFilter[],
): Prisma.RegistrationWorkspaceWhereInput {
  if (types.length === 0 || types.length === STAFF_REGISTRATION_TYPE_FILTERS.length) {
    return {};
  }
  return {
    registrationType: { in: types as RegistrationType[] },
  };
}

export function workspaceListTitle(types: StaffRegistrationTypeFilter[]): string {
  if (types.length === 1) {
    switch (types[0]) {
      case "NORMAL":
        return "Internal Student Registrations";
      case "RESTRICTED":
        return "Restricted Registrations";
      case "EXTERNAL":
        return "External Candidate Registrations";
    }
  }
  return "Registrations";
}

export function workspaceListDescription(types: StaffRegistrationTypeFilter[]): string {
  if (types.length === 1 && types[0] === "NORMAL") {
    return "Student-visible registrations for fee statements, confirmation print, and post-lock adjustments.";
  }
  if (types.length === 1 && types[0] === "RESTRICTED") {
    return "Office-only restricted registrations. Use restricted invoices — not normal student fee statements.";
  }
  if (types.length === 1 && types[0] === "EXTERNAL") {
    return "External candidate registrations managed by Admin and Exam Officer only.";
  }
  return "Registrations for the selected registration window and type filters.";
}

export type WorkspaceTableView = "normal" | "restricted" | "external" | "mixed";

export function resolveWorkspaceTableView(
  types: StaffRegistrationTypeFilter[],
): WorkspaceTableView {
  if (types.length === 1) {
    if (types[0] === "NORMAL") return "normal";
    if (types[0] === "RESTRICTED") return "restricted";
    return "external";
  }
  return "mixed";
}

export function registrationTypeBadgeClass(type: string): string {
  switch (type) {
    case "RESTRICTED":
      return "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200";
    case "EXTERNAL":
      return "bg-violet-100 text-violet-800 ring-1 ring-inset ring-violet-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";
  }
}

export function registrationTypeBadgeLabel(type: string): string {
  switch (type) {
    case "RESTRICTED":
      return "Restricted";
    case "EXTERNAL":
      return "External";
    default:
      return "Normal";
  }
}

export function includesNormalRegistrations(types: StaffRegistrationTypeFilter[]): boolean {
  return types.includes("NORMAL");
}

export function includesRestrictedRegistrations(types: StaffRegistrationTypeFilter[]): boolean {
  return types.includes("RESTRICTED");
}

export function includesExternalRegistrations(types: StaffRegistrationTypeFilter[]): boolean {
  return types.includes("EXTERNAL");
}

export function parseFeeStatementType(searchParams: URLSearchParams): StaffRegistrationTypeFilter {
  const raw = searchParams.get("statementType");
  if (raw && isStaffRegistrationTypeFilter(raw)) {
    return raw;
  }
  return "NORMAL";
}

export const FEE_STATEMENT_TYPE_RADIO_LABELS: Record<StaffRegistrationTypeFilter, string> = {
  NORMAL: "Internal / Normal",
  RESTRICTED: "Restricted",
  EXTERNAL: "External",
};
