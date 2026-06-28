import type {
  BillingScope,
  CandidateType,
  FeeStatementStatus,
  RegistrationSource,
  RegistrationVisibility,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { AUTO_BILLING_SCOPES } from "@/lib/registrations/metadata";

export interface FeeReportFilters {
  registrationWindowId?: string;
  examBoardId?: string;
  examSeriesId?: string;
  year?: number;
  month?: number;
  grade?: string;
  className?: string;
  candidateType?: CandidateType;
  registrationSource?: RegistrationSource;
  visibility?: RegistrationVisibility;
  billingScope?: BillingScope;
  statementStatus?: FeeStatementStatus;
  includeExternal?: boolean;
  includeOfficeOnly?: boolean;
  includeManualReview?: boolean;
}

export function resolveBillingScopes(filters: FeeReportFilters): BillingScope[] {
  if (filters.billingScope) {
    return filters.billingScope === "NO_BILLING" ? [] : [filters.billingScope];
  }
  const scopes: BillingScope[] = [...AUTO_BILLING_SCOPES];
  if (filters.includeOfficeOnly) scopes.push("OFFICE_ONLY_BILLING");
  if (filters.includeManualReview) scopes.push("MANUAL_REVIEW");
  return scopes;
}

export function buildRegistrationWhereFromFeeFilters(
  filters: FeeReportFilters,
): Prisma.StudentExamRegistrationWhereInput {
  const where: Prisma.StudentExamRegistrationWhereInput = {
    status: { in: ["ACTIVE", "LOCKED"] },
  };

  const billingScopes = resolveBillingScopes(filters);
  if (billingScopes.length === 0) {
    where.id = "__no_billing__";
    return where;
  }
  where.billingScope = { in: billingScopes };

  if (filters.grade) where.gradeSnapshot = filters.grade;
  if (filters.className) where.classNameSnapshot = filters.className;
  if (filters.registrationSource) where.registrationSource = filters.registrationSource;
  if (filters.visibility) where.visibility = filters.visibility;
  if (filters.candidateType) where.candidateTypeSnapshot = filters.candidateType;
  if (filters.includeExternal === false) {
    where.candidateTypeSnapshot = { not: "EXTERNAL" };
  }

  if (filters.year || filters.month) {
    where.examSession = {
      date: {
        ...(filters.year
          ? {
              gte: new Date(filters.year, (filters.month ?? 1) - 1, 1),
              lt: filters.month
                ? new Date(filters.year, filters.month, 1)
                : new Date(filters.year + 1, 0, 1),
            }
          : {}),
      },
    };
  }

  return where;
}

export function buildWorkspaceWhereFromFeeFilters(
  filters: FeeReportFilters,
): Prisma.RegistrationWorkspaceWhereInput {
  const where: Prisma.RegistrationWorkspaceWhereInput = {
    lockedAt: { not: null },
  };

  if (filters.registrationWindowId) {
    where.registrationWindowId = filters.registrationWindowId;
  }

  if (filters.examBoardId || filters.examSeriesId) {
    where.registrationWindow = {
      ...(filters.examBoardId ? { examBoardId: filters.examBoardId } : {}),
      ...(filters.examSeriesId ? { examSeriesId: filters.examSeriesId } : {}),
    };
  }

  return where;
}

export function parseFeeReportFilters(searchParams: URLSearchParams): FeeReportFilters {
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const candidateType = searchParams.get("candidateType")?.toUpperCase();

  return {
    registrationWindowId: searchParams.get("registrationWindowId") || undefined,
    examBoardId: searchParams.get("examBoardId") || undefined,
    examSeriesId: searchParams.get("examSeriesId") || undefined,
    year: year ? Number(year) : undefined,
    month: month ? Number(month) : undefined,
    grade: searchParams.get("grade")?.trim() || undefined,
    className: searchParams.get("className")?.trim() || undefined,
    candidateType:
      candidateType === "INTERNAL" || candidateType === "EXTERNAL"
        ? candidateType
        : undefined,
    registrationSource:
      (searchParams.get("registrationSource") as RegistrationSource) || undefined,
    visibility: (searchParams.get("visibility") as RegistrationVisibility) || undefined,
    billingScope: (searchParams.get("billingScope") as BillingScope) || undefined,
    statementStatus: (searchParams.get("statementStatus") as FeeStatementStatus) || undefined,
    includeExternal: searchParams.get("includeExternal") !== "false",
    includeOfficeOnly: searchParams.get("includeOfficeOnly") === "true",
    includeManualReview: searchParams.get("includeManualReview") === "true",
  };
}

export function feeFiltersToQueryString(filters: FeeReportFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

export const FEE_DETAILS_PAGE_SIZES = [50, 100] as const;

export function parseFeeDetailsPagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const rawSize = Number(searchParams.get("pageSize") ?? "50") || 50;
  const pageSize = FEE_DETAILS_PAGE_SIZES.includes(rawSize as (typeof FEE_DETAILS_PAGE_SIZES)[number])
    ? rawSize
    : 50;
  return { page, pageSize };
}
