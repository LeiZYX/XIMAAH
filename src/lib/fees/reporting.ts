import { calculateFeeAmounts } from "@/lib/fees/calculate";
import type { FeeReportFilters } from "@/lib/fees/filters";
import {
  buildRegistrationWhereFromFeeFilters,
  buildWorkspaceWhereFromFeeFilters,
} from "@/lib/fees/filters";
import { findMatchingFeeRule, resolveEntryTypeForWorkspace } from "@/lib/fees/match";
import { loadWorkspacesWithEntryType } from "@/lib/fees/workspace-entry-type";
import { toNumber } from "@/lib/fees/money";
import type { Prisma } from "@/generated/prisma/client";
import { FeeStatementStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export interface FeeSummaryCards {
  totalCandidates: number;
  totalExamEntries: number;
  totalGbpAmount: number;
  totalCnyAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  missingFeeRules: number;
  statementsGenerated: number;
  statementsNotGenerated: number;
}

export interface FeeSummaryRow {
  registrationWindowId: string;
  registrationWindowTitle: string;
  examBoardName: string;
  examSeriesName: string;
  examSeriesYear: number;
  grade: string;
  className: string;
  candidateType: string;
  subjectName: string;
  candidateCount: number;
  examEntryCount: number;
  totalGbp: number;
  totalCny: number;
  missingFeeRuleCount: number;
  statementCount: number;
}

export interface FeeDetailRow {
  statementId: string | null;
  statementNo: string | null;
  candidateName: string;
  assessmentHubCandidateNumber: string | null;
  studentNumber: string | null;
  candidateType: string | null;
  grade: string;
  className: string;
  registrationSource: string | null;
  visibility: string | null;
  billingScope: string | null;
  examBoardName: string;
  examSeriesName: string;
  examSeriesYear: number;
  subjectName: string;
  paperCode: string;
  paperTitle: string;
  entryType: string;
  examDate: string | null;
  costCurrency: string | null;
  costAmount: number | null;
  exchangeRate: number | null;
  markupType: string | null;
  markupValue: number | null;
  salesGbp: number;
  salesCny: number;
  statementStatus: string;
  generatedAt: string | null;
  registrationWindowTitle: string;
}

type RegRow = {
  id: string;
  candidateId: string | null;
  studentId: string | null;
  examBoardId: string;
  examSeriesId: string;
  subjectId: string;
  paperId: string;
  examSessionId: string;
  gradeSnapshot: string;
  classNameSnapshot: string;
  studentNameSnapshot: string;
  studentNoSnapshot: string;
  assessmentHubCandidateNumberSnapshot: string | null;
  candidateTypeSnapshot: string | null;
  registrationSource: string | null;
  visibility: string | null;
  billingScope: string | null;
  registrationWorkspaceId: string | null;
  subject: { name: string; qualificationId: string };
  paper: { code: string; title: string };
  examSession: { date: Date };
  examBoard: { name: string };
  examSeries: { name: string; year: number };
  registrationWindow: {
    id: string;
    title: string;
    entryType?: import("@/generated/prisma/enums").FeeEntryType;
    isLateRegistration?: boolean;
  };
};

function resolveRegEntryType(reg: RegRow): import("@/generated/prisma/enums").FeeEntryType {
  return resolveEntryTypeForWorkspace({
    entryType: reg.registrationWindow.entryType ?? null,
    isLateRegistration: reg.registrationWindow.isLateRegistration ?? false,
  });
}

async function loadBillableRegistrations(filters: FeeReportFilters): Promise<RegRow[]> {
  const workspaceWhere = buildWorkspaceWhereFromFeeFilters(filters);
  const regWhere = buildRegistrationWhereFromFeeFilters(filters);

  const workspaces = await loadWorkspacesWithEntryType(workspaceWhere);

  if (workspaces.length === 0) return [];

  const workspaceIds = workspaces.map((w) => w.id);
  const entryByWorkspace = new Map(
    workspaces.map((w) => [
      w.id,
      resolveEntryTypeForWorkspace({ entryType: w.entryType, isLateRegistration: w.isLateRegistration }),
    ]),
  );

  return prisma.studentExamRegistration.findMany({
    where: {
      ...regWhere,
      registrationWorkspaceId: { in: workspaceIds },
    },
    include: {
      subject: { select: { name: true, qualificationId: true } },
      paper: { select: { code: true, title: true } },
      examSession: { select: { date: true } },
      examBoard: { select: { name: true } },
      examSeries: { select: { name: true, year: true } },
      registrationWindow: { select: { id: true, title: true } },
    },
  }).then((rows) =>
    rows.map((row) => ({
      ...row,
      registrationWindow: {
        ...row.registrationWindow,
        isLateRegistration: row.registrationWorkspaceId
          ? entryByWorkspace.get(row.registrationWorkspaceId) !== "NORMAL"
          : false,
        entryType: row.registrationWorkspaceId
          ? entryByWorkspace.get(row.registrationWorkspaceId)
          : "NORMAL",
      },
    })),
  ) as Promise<RegRow[]>;
}

function candidateKey(row: RegRow): string {
  return row.candidateId ?? row.studentId ?? row.id;
}

export async function buildFeeSummaryReport(filters: FeeReportFilters): Promise<{
  cards: FeeSummaryCards;
  rows: FeeSummaryRow[];
}> {
  const registrations = await loadBillableRegistrations(filters);
  const windowIds = [...new Set(registrations.map((r) => r.registrationWindow.id))];

  const [rules, exchangeRates, statements] = await Promise.all([
    prisma.feeRule.findMany({
      where: {
        registrationWindowId: filters.registrationWindowId
          ? filters.registrationWindowId
          : { in: windowIds },
        isActive: true,
      },
    }),
    prisma.exchangeRate.findMany({
      where: {
        registrationWindowId: filters.registrationWindowId
          ? filters.registrationWindowId
          : { in: windowIds },
      },
      orderBy: { effectiveDate: "desc" },
    }),
    prisma.feeStatement.findMany({
      where: {
        registrationWindowId: filters.registrationWindowId
          ? filters.registrationWindowId
          : { in: windowIds },
        status: filters.statementStatus
          ? filters.statementStatus
          : { in: ["DRAFT", "ISSUED", "PAID", "NEEDS_REVIEW"] },
      },
      select: {
        id: true,
        registrationWorkspaceId: true,
        status: true,
        totalGbpAmount: true,
        totalCnyAmount: true,
      },
    }),
  ]);

  const statementsByWorkspace = new Map<string, typeof statements>();
  for (const statement of statements) {
    const list = statementsByWorkspace.get(statement.registrationWorkspaceId) ?? [];
    list.push(statement);
    statementsByWorkspace.set(statement.registrationWorkspaceId, list);
  }

  const groupMap = new Map<
    string,
    FeeSummaryRow & { candidateIds: Set<string>; workspaceIds: Set<string> }
  >();

  let missingFeeRules = 0;
  let totalGbp = 0;
  let totalCny = 0;
  const allCandidates = new Set<string>();
  const workspacesWithStatement = new Set<string>();

  for (const reg of registrations) {
    allCandidates.add(candidateKey(reg));
    const entryType = resolveRegEntryType(reg);
    const match = findMatchingFeeRule(rules, {
      examBoardId: reg.examBoardId,
      examSeriesId: reg.examSeriesId,
      qualificationId: reg.subject.qualificationId,
      subjectId: reg.subjectId,
      paperId: reg.paperId,
      examSessionId: reg.examSessionId,
      entryType,
    });

    let lineGbp = 0;
    let lineCny = 0;
    let missing = 0;
    if (!match) {
      missing = 1;
      missingFeeRules += 1;
    } else {
      const amounts = calculateFeeAmounts(match, exchangeRates);
      lineGbp = amounts.salesGbp;
      lineCny = amounts.salesCny;
      totalGbp += lineGbp;
      totalCny += lineCny;
    }

    const groupKey = [
      reg.registrationWindow.id,
      reg.examBoard.name,
      reg.examSeries.name,
      reg.gradeSnapshot,
      reg.classNameSnapshot,
      reg.candidateTypeSnapshot ?? "INTERNAL",
      reg.subject.name,
    ].join("|");

    const existing = groupMap.get(groupKey);
    if (existing) {
      existing.examEntryCount += 1;
      existing.totalGbp += lineGbp;
      existing.totalCny += lineCny;
      existing.missingFeeRuleCount += missing;
      existing.candidateIds.add(candidateKey(reg));
      if (reg.registrationWorkspaceId) existing.workspaceIds.add(reg.registrationWorkspaceId);
    } else {
      groupMap.set(groupKey, {
        registrationWindowId: reg.registrationWindow.id,
        registrationWindowTitle: reg.registrationWindow.title,
        examBoardName: reg.examBoard.name,
        examSeriesName: reg.examSeries.name,
        examSeriesYear: reg.examSeries.year,
        grade: reg.gradeSnapshot,
        className: reg.classNameSnapshot,
        candidateType: reg.candidateTypeSnapshot ?? "INTERNAL",
        subjectName: reg.subject.name,
        candidateCount: 0,
        examEntryCount: 1,
        totalGbp: lineGbp,
        totalCny: lineCny,
        missingFeeRuleCount: missing,
        statementCount: 0,
        candidateIds: new Set([candidateKey(reg)]),
        workspaceIds: new Set(reg.registrationWorkspaceId ? [reg.registrationWorkspaceId] : []),
      });
    }
  }

  for (const group of groupMap.values()) {
    group.candidateCount = group.candidateIds.size;
    let stmtCount = 0;
    for (const wsId of group.workspaceIds) {
      const wsStatements = statementsByWorkspace.get(wsId) ?? [];
      if (wsStatements.length > 0) {
        stmtCount += wsStatements.length;
        workspacesWithStatement.add(wsId);
      }
    }
    group.statementCount = stmtCount;
  }

  const lockedWorkspaceIds = new Set(
    registrations.map((r) => r.registrationWorkspaceId).filter(Boolean) as string[],
  );

  let paidAmount = 0;
  let unpaidAmount = 0;
  for (const statement of statements) {
    const gbp = toNumber(statement.totalGbpAmount);
    const cny = toNumber(statement.totalCnyAmount);
    if (statement.status === "PAID") {
      paidAmount += gbp + cny;
    } else if (statement.status === "ISSUED") {
      unpaidAmount += gbp + cny;
    }
  }

  const rows = [...groupMap.values()].map(({ candidateIds, workspaceIds, ...row }) => row);

  return {
    cards: {
      totalCandidates: allCandidates.size,
      totalExamEntries: registrations.length,
      totalGbpAmount: Math.round(totalGbp * 100) / 100,
      totalCnyAmount: Math.round(totalCny * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      unpaidAmount: Math.round(unpaidAmount * 100) / 100,
      missingFeeRules,
      statementsGenerated: workspacesWithStatement.size,
      statementsNotGenerated: lockedWorkspaceIds.size - workspacesWithStatement.size,
    },
    rows,
  };
}

export async function buildFeeDetailsReport(
  filters: FeeReportFilters,
  showCosts: boolean,
): Promise<FeeDetailRow[]> {
  if (!filters.registrationWindowId) {
    return [];
  }

  const regWhere = buildRegistrationWhereFromFeeFilters(filters);

  const statementWhere: Prisma.FeeStatementWhereInput = {
    ...(filters.registrationWindowId
      ? { registrationWindowId: filters.registrationWindowId }
      : filters.examBoardId || filters.examSeriesId
        ? {
            registrationWindow: {
              examBoardId: filters.examBoardId,
              examSeriesId: filters.examSeriesId,
            },
          }
        : {}),
    status: filters.statementStatus
      ? filters.statementStatus
      : {
          in: [
            FeeStatementStatus.DRAFT,
            FeeStatementStatus.ISSUED,
            FeeStatementStatus.PAID,
            FeeStatementStatus.NEEDS_REVIEW,
          ],
        },
    registrationWorkspace: {
      lockedAt: { not: null },
    },
  };

  const statements = await prisma.feeStatement.findMany({
    where: statementWhere,
    include: {
      items: {
        include: {
          examSession: { select: { date: true } },
        },
      },
      registrationWindow: {
        include: {
          examBoard: { select: { name: true } },
          examSeries: { select: { name: true, year: true } },
        },
      },
      registrationWorkspace: {
        include: {
          registrations: {
            where: regWhere,
            select: {
              examSessionId: true,
              registrationSource: true,
              visibility: true,
              billingScope: true,
            },
          },
        },
      },
    },
    orderBy: [{ generatedAt: "desc" }],
  });

  const details: FeeDetailRow[] = [];

  for (const statement of statements) {
    const matchingRegs = new Map(
      (statement.registrationWorkspace?.registrations ?? []).map((r) => [
        r.examSessionId,
        r,
      ]),
    );

    for (const item of statement.items) {
      if (!item.examSessionId) continue;
      const regMeta = matchingRegs.get(item.examSessionId);
      if (filters.registrationSource && regMeta?.registrationSource !== filters.registrationSource) {
        continue;
      }
      if (filters.visibility && regMeta?.visibility !== filters.visibility) continue;
      if (filters.billingScope && regMeta?.billingScope !== filters.billingScope) continue;
      if (filters.grade && statement.gradeSnapshot !== filters.grade) continue;
      if (filters.className && statement.classNameSnapshot !== filters.className) continue;
      if (filters.candidateType && statement.candidateTypeSnapshot !== filters.candidateType) {
        continue;
      }

      details.push({
        statementId: statement.id,
        statementNo: statement.statementNo,
        candidateName: statement.studentNameSnapshot,
        assessmentHubCandidateNumber: statement.assessmentHubCandidateNumberSnapshot,
        studentNumber:
          statement.candidateTypeSnapshot === "INTERNAL" ? statement.studentNoSnapshot : null,
        candidateType: statement.candidateTypeSnapshot,
        grade: statement.gradeSnapshot,
        className: statement.classNameSnapshot,
        registrationSource: regMeta?.registrationSource ?? null,
        visibility: regMeta?.visibility ?? null,
        billingScope: regMeta?.billingScope ?? null,
        examBoardName: statement.registrationWindow.examBoard.name,
        examSeriesName: statement.registrationWindow.examSeries.name,
        examSeriesYear: statement.registrationWindow.examSeries.year,
        subjectName: item.subjectSnapshot,
        paperCode: item.paperCodeSnapshot,
        paperTitle: item.paperTitleSnapshot,
        entryType: item.entryTypeSnapshot,
        examDate: item.examSession?.date?.toISOString() ?? null,
        costCurrency: showCosts ? item.costCurrencySnapshot : null,
        costAmount: showCosts ? toNumber(item.costAmountSnapshot) : null,
        exchangeRate: item.exchangeRateSnapshot ? toNumber(item.exchangeRateSnapshot) : null,
        markupType: showCosts ? item.markupTypeSnapshot : null,
        markupValue: showCosts && item.markupValueSnapshot ? toNumber(item.markupValueSnapshot) : null,
        salesGbp: toNumber(item.salesGbpAmountSnapshot),
        salesCny: toNumber(item.salesCnyAmountSnapshot),
        statementStatus: statement.status,
        generatedAt: statement.generatedAt.toISOString(),
        registrationWindowTitle: statement.registrationWindow.title,
      });
    }
  }

  if (details.length === 0) {
    const registrations = await loadBillableRegistrations(filters);
    const windowIds = [...new Set(registrations.map((r) => r.registrationWindow.id))];
    const rules = await prisma.feeRule.findMany({
      where: {
        registrationWindowId: { in: windowIds },
        isActive: true,
      },
    });
    const exchangeRates = await prisma.exchangeRate.findMany({
      where: { registrationWindowId: { in: windowIds } },
      orderBy: { effectiveDate: "desc" },
    });

    for (const reg of registrations) {
      const entryType = resolveRegEntryType(reg);
      const match = findMatchingFeeRule(rules, {
        examBoardId: reg.examBoardId,
        examSeriesId: reg.examSeriesId,
        qualificationId: reg.subject.qualificationId,
        subjectId: reg.subjectId,
        paperId: reg.paperId,
        examSessionId: reg.examSessionId,
        entryType,
      });

      let salesGbp = 0;
      let salesCny = 0;
      let costCurrency: string | null = null;
      let costAmount: number | null = null;
      let markupType: string | null = null;
      let markupValue: number | null = null;
      let exchangeRate: number | null = null;

      if (match) {
        const amounts = calculateFeeAmounts(match, exchangeRates);
        salesGbp = amounts.salesGbp;
        salesCny = amounts.salesCny;
        if (showCosts) {
          costCurrency = match.costCurrency;
          costAmount = toNumber(match.costAmount);
          markupType = match.markupType;
          markupValue = match.markupValue ? toNumber(match.markupValue) : null;
          exchangeRate = amounts.exchangeRateGbpToCny;
        }
      }

      details.push({
        statementId: null,
        statementNo: null,
        candidateName: reg.studentNameSnapshot,
        assessmentHubCandidateNumber: reg.assessmentHubCandidateNumberSnapshot,
        studentNumber:
          reg.candidateTypeSnapshot === "INTERNAL" ? reg.studentNoSnapshot : null,
        candidateType: reg.candidateTypeSnapshot,
        grade: reg.gradeSnapshot,
        className: reg.classNameSnapshot,
        registrationSource: reg.registrationSource,
        visibility: reg.visibility,
        billingScope: reg.billingScope,
        examBoardName: reg.examBoard.name,
        examSeriesName: reg.examSeries.name,
        examSeriesYear: reg.examSeries.year,
        subjectName: reg.subject.name,
        paperCode: reg.paper.code,
        paperTitle: reg.paper.title,
        entryType,
        examDate: reg.examSession.date.toISOString(),
        costCurrency,
        costAmount,
        exchangeRate,
        markupType,
        markupValue,
        salesGbp,
        salesCny,
        statementStatus: "NOT_GENERATED",
        generatedAt: null,
        registrationWindowTitle: reg.registrationWindow.title,
      });
    }
  }

  return details;
}

export interface CandidateFeeDetailGroup {
  candidateKey: string;
  candidateName: string;
  assessmentHubCandidateNumber: string | null;
  studentNumber: string | null;
  candidateType: string | null;
  grade: string;
  className: string;
  statementNo: string | null;
  statementStatus: string;
  totalSalesGbp: number;
  totalSalesCny: number;
  lineCount: number;
  lines: FeeDetailRow[];
}

export function candidateKeyFromDetailRow(row: FeeDetailRow): string {
  return (
    row.assessmentHubCandidateNumber ??
    row.studentNumber ??
    row.candidateName
  ).trim();
}

export function groupFeeDetailsByCandidate(rows: FeeDetailRow[]): CandidateFeeDetailGroup[] {
  const map = new Map<string, CandidateFeeDetailGroup>();

  for (const row of rows) {
    const key = candidateKeyFromDetailRow(row);
    const existing = map.get(key);
    if (existing) {
      existing.lines.push(row);
      existing.lineCount += 1;
      existing.totalSalesGbp += row.salesGbp;
      existing.totalSalesCny += row.salesCny;
      if (!existing.statementNo && row.statementNo) {
        existing.statementNo = row.statementNo;
        existing.statementStatus = row.statementStatus;
      }
    } else {
      map.set(key, {
        candidateKey: key,
        candidateName: row.candidateName,
        assessmentHubCandidateNumber: row.assessmentHubCandidateNumber,
        studentNumber: row.studentNumber,
        candidateType: row.candidateType,
        grade: row.grade,
        className: row.className,
        statementNo: row.statementNo,
        statementStatus: row.statementStatus,
        totalSalesGbp: row.salesGbp,
        totalSalesCny: row.salesCny,
        lineCount: 1,
        lines: [row],
      });
    }
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      totalSalesGbp: Math.round(group.totalSalesGbp * 100) / 100,
      totalSalesCny: Math.round(group.totalSalesCny * 100) / 100,
      lines: [...group.lines].sort((a, b) => {
        const dateCompare =
          new Date(a.examDate ?? 0).getTime() - new Date(b.examDate ?? 0).getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.paperCode.localeCompare(b.paperCode);
      }),
    }))
    .sort((a, b) => a.candidateName.localeCompare(b.candidateName));
}

export async function buildFeeDetailsReportPaginated(
  filters: FeeReportFilters,
  showCosts: boolean,
  page: number,
  pageSize: number,
): Promise<{
  groups: CandidateFeeDetailGroup[];
  totalCandidates: number;
  totalLines: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  if (!filters.registrationWindowId) {
    return {
      groups: [],
      totalCandidates: 0,
      totalLines: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const allRows = await buildFeeDetailsReport(filters, showCosts);
  const allGroups = groupFeeDetailsByCandidate(allRows);
  const totalCandidates = allGroups.length;
  const totalLines = allRows.length;
  const totalPages = totalCandidates === 0 ? 0 : Math.ceil(totalCandidates / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const groups = allGroups.slice(start, start + pageSize);

  return {
    groups,
    totalCandidates,
    totalLines,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function buildFeeDashboardMetrics(): Promise<{
  feeStatementsPending: number;
  missingFeeRules: number;
  totalFeesCurrentWindowGbp: number;
  totalFeesCurrentWindowCny: number;
  unpaidStatements: number;
  currentWindowId: string | null;
  currentWindowTitle: string | null;
}> {
  const openWindow = await prisma.registrationWindow.findFirst({
    where: { status: { in: ["OPEN", "CLOSED"] } },
    orderBy: { registrationCloseAt: "desc" },
    select: { id: true, title: true },
  });

  const filters: FeeReportFilters = openWindow
    ? { registrationWindowId: openWindow.id }
    : {};

  const summary = await buildFeeSummaryReport(filters);

  const pendingStatements = await prisma.feeStatement.count({
    where: {
      status: { in: ["DRAFT", "NEEDS_REVIEW"] },
      ...(openWindow ? { registrationWindowId: openWindow.id } : {}),
    },
  });

  const unpaidStatements = await prisma.feeStatement.count({
    where: {
      status: "ISSUED",
      ...(openWindow ? { registrationWindowId: openWindow.id } : {}),
    },
  });

  return {
    feeStatementsPending: pendingStatements,
    missingFeeRules: summary.cards.missingFeeRules,
    totalFeesCurrentWindowGbp: summary.cards.totalGbpAmount,
    totalFeesCurrentWindowCny: summary.cards.totalCnyAmount,
    unpaidStatements,
    currentWindowId: openWindow?.id ?? null,
    currentWindowTitle: openWindow?.title ?? null,
  };
}
