import { calculateFeeAmounts } from "@/lib/fees/calculate";
import {
  CANDIDATE_REGISTRATION_FEE_SERVICE_NAME,
  loadCandidateRegistrationFeeSchedule,
  calculateFeeScheduleAmounts,
} from "@/lib/fees/candidate-registration-fee";
import type { FeeReportFilters } from "@/lib/fees/filters";
import {
  buildRegistrationWhereFromFeeFilters,
  buildWorkspaceWhereFromFeeFilters,
} from "@/lib/fees/filters";
import { findMatchingFeeRuleWithFallback, resolveEntryTypeForWorkspace } from "@/lib/fees/match";
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

export interface FeeSummaryFacet {
  key: string;
  label: string;
  count: number;
}

/** One row per student (workspace) for Fee Summary. */
export interface FeeSummaryRow {
  candidateKey: string;
  englishName: string;
  chineseName: string | null;
  candidateType: string;
  grade: string;
  className: string;
  registrationWindowId: string;
  registrationWindowTitle: string;
  examBoardName: string;
  examSeriesName: string;
  examSeriesYear: number;
  subjectCount: number;
  registrationFeeGbp: number | null;
  amountDueGbp: number;
  paymentStatus: string;
  statementStatus: string;
  statementNo: string | null;
  generatedAt: string | null;
  systemMessages: string[];
  missingFeeRuleCount: number;
}

function feeSummaryPaymentStatus(statementStatus: string): string {
  switch (statementStatus) {
    case "PAID":
      return "Paid";
    case "ISSUED":
      return "Unpaid";
    case "DRAFT":
      return "Draft";
    case "NEEDS_REGENERATION":
      return "Needs regeneration";
    case "NOT_GENERATED":
      return "No statement";
    default:
      return statementStatus.replace(/_/g, " ");
  }
}

export interface FeeDetailRow {
  statementId: string | null;
  statementNo: string | null;
  candidateName: string;
  permanentStudentId: string | null;
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
  candidate?: { studentId: string | null; chineseName?: string | null } | null;
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
      candidate: { select: { studentId: true, chineseName: true } },
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
  byGrade: FeeSummaryFacet[];
  byClass: FeeSummaryFacet[];
  systemTips: string[];
}> {
  // Load without grade/class so facets cover the full type/window scope.
  const registrations = await loadBillableRegistrations({
    ...filters,
    grade: undefined,
    className: undefined,
  });
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
        status: {
          in: ["ISSUED", "PAID", "NEEDS_REGENERATION", "DRAFT"],
        },
      },
      select: {
        id: true,
        registrationWorkspaceId: true,
        status: true,
        statementNo: true,
        totalGbpAmount: true,
        totalCnyAmount: true,
        amountDueGbpAmount: true,
        generatedAt: true,
        regenerationReason: true,
      },
      orderBy: [{ generatedAt: "desc" }],
    }),
  ]);

  const workspaceIdsFromRegs = [
    ...new Set(registrations.map((r) => r.registrationWorkspaceId).filter(Boolean) as string[]),
  ];
  const candidateFeeWorkspaceIds = new Set(
    workspaceIdsFromRegs.length === 0
      ? []
      : (
          await prisma.registrationWorkspace.findMany({
            where: {
              id: { in: workspaceIdsFromRegs },
              includeCandidateRegistrationFee: true,
            },
            select: { id: true },
          })
        ).map((row) => row.id),
  );

  type StudentAgg = {
    candidateKey: string;
    workspaceId: string | null;
    englishName: string;
    chineseName: string | null;
    candidateType: string;
    grade: string;
    className: string;
    registrationWindowId: string;
    registrationWindowTitle: string;
    examBoardName: string;
    examSeriesName: string;
    examSeriesYear: number;
    examBoardId: string;
    subjectIds: Set<string>;
    examEntryCount: number;
    examGbp: number;
    registrationFeeGbp: number | null;
    missingFeeRuleCount: number;
    systemMessages: string[];
  };

  const studentMap = new Map<string, StudentAgg>();
  const candidateFeeWorkspacesHandled = new Set<string>();
  let totalCny = 0;

  for (const reg of registrations) {
    const key =
      reg.registrationWorkspaceId ??
      `${candidateKey(reg)}|${reg.registrationWindow.id}`;
    let student = studentMap.get(key);
    if (!student) {
      student = {
        candidateKey: candidateKey(reg),
        workspaceId: reg.registrationWorkspaceId,
        englishName: reg.studentNameSnapshot,
        chineseName: reg.candidate?.chineseName?.trim() || null,
        candidateType: reg.candidateTypeSnapshot ?? "INTERNAL",
        grade: reg.gradeSnapshot,
        className: reg.classNameSnapshot,
        registrationWindowId: reg.registrationWindow.id,
        registrationWindowTitle: reg.registrationWindow.title,
        examBoardName: reg.examBoard.name,
        examSeriesName: reg.examSeries.name,
        examSeriesYear: reg.examSeries.year,
        examBoardId: reg.examBoardId,
        subjectIds: new Set(),
        examEntryCount: 0,
        examGbp: 0,
        registrationFeeGbp: null,
        missingFeeRuleCount: 0,
        systemMessages: [],
      };
      studentMap.set(key, student);
    }

    student.subjectIds.add(reg.subjectId);
    student.examEntryCount += 1;

    const entryType = resolveRegEntryType(reg);
    const match = findMatchingFeeRuleWithFallback(rules, {
      examBoardId: reg.examBoardId,
      examSeriesId: reg.examSeriesId,
      qualificationId: reg.subject.qualificationId,
      subjectId: reg.subjectId,
      paperId: reg.paperId,
      examSessionId: reg.examSessionId,
      entryType,
    });

    if (!match) {
      student.missingFeeRuleCount += 1;
    } else {
      const amounts = calculateFeeAmounts(match, exchangeRates);
      student.examGbp += amounts.salesGbp;
      totalCny += amounts.salesCny;
    }

    if (
      reg.registrationWorkspaceId &&
      candidateFeeWorkspaceIds.has(reg.registrationWorkspaceId) &&
      !candidateFeeWorkspacesHandled.has(reg.registrationWorkspaceId)
    ) {
      candidateFeeWorkspacesHandled.add(reg.registrationWorkspaceId);
      const schedule = await loadCandidateRegistrationFeeSchedule(reg.examBoardId);
      if (!schedule) {
        student.missingFeeRuleCount += 1;
        student.systemMessages.push("Candidate registration fee schedule missing");
        student.registrationFeeGbp = 0;
      } else {
        const windowRates = exchangeRates.filter(
          (rate) => rate.registrationWindowId === reg.registrationWindow.id,
        );
        const amounts = calculateFeeScheduleAmounts(schedule, windowRates);
        student.registrationFeeGbp = amounts.salesGbp;
        totalCny += amounts.salesCny;
      }
    }
  }

  const latestStatementByWorkspace = new Map<string, (typeof statements)[number]>();
  for (const statement of statements) {
    if (!statement.registrationWorkspaceId) continue;
    if (!latestStatementByWorkspace.has(statement.registrationWorkspaceId)) {
      latestStatementByWorkspace.set(statement.registrationWorkspaceId, statement);
    }
  }

  const allStudents: FeeSummaryRow[] = [...studentMap.values()].map((student) => {
    const statement = student.workspaceId
      ? latestStatementByWorkspace.get(student.workspaceId)
      : undefined;
    const statementStatus = statement?.status ?? "NOT_GENERATED";
    const messages = [...student.systemMessages];
    if (student.missingFeeRuleCount > 0) {
      messages.push(
        `${student.missingFeeRuleCount} missing fee rule${student.missingFeeRuleCount === 1 ? "" : "s"}`,
      );
    }
    if (statementStatus === "NEEDS_REGENERATION") {
      messages.push(
        statement?.regenerationReason?.trim() || "Fee statement needs regeneration",
      );
    }

    const calculatedDue =
      Math.round((student.examGbp + (student.registrationFeeGbp ?? 0)) * 100) / 100;
    const amountDueGbp = statement
      ? toNumber(statement.amountDueGbpAmount ?? statement.totalGbpAmount)
      : calculatedDue;

    return {
      candidateKey: student.candidateKey,
      englishName: student.englishName,
      chineseName: student.chineseName,
      candidateType: student.candidateType,
      grade: student.grade,
      className: student.className,
      registrationWindowId: student.registrationWindowId,
      registrationWindowTitle: student.registrationWindowTitle,
      examBoardName: student.examBoardName,
      examSeriesName: student.examSeriesName,
      examSeriesYear: student.examSeriesYear,
      subjectCount: student.subjectIds.size,
      registrationFeeGbp: student.registrationFeeGbp,
      amountDueGbp: Math.round(amountDueGbp * 100) / 100,
      paymentStatus: feeSummaryPaymentStatus(statementStatus),
      statementStatus,
      statementNo: statement?.statementNo ?? null,
      generatedAt: statement?.generatedAt?.toISOString() ?? null,
      systemMessages: [...new Set(messages)],
      missingFeeRuleCount: student.missingFeeRuleCount,
    };
  });

  const gradeCounts = new Map<string, number>();
  for (const row of allStudents) {
    const key = row.grade?.trim() || "UNASSIGNED";
    gradeCounts.set(key, (gradeCounts.get(key) ?? 0) + 1);
  }
  const byGrade: FeeSummaryFacet[] = [...gradeCounts.entries()]
    .map(([key, count]) => ({
      key,
      label: key === "UNASSIGNED" ? "Unassigned grade" : key,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const gradeForClass = filters.grade?.trim();
  const classSource = gradeForClass
    ? allStudents.filter((row) => (row.grade?.trim() || "UNASSIGNED") === gradeForClass)
    : allStudents;
  const classCounts = new Map<string, number>();
  for (const row of classSource) {
    const key = row.className?.trim() || "UNASSIGNED";
    classCounts.set(key, (classCounts.get(key) ?? 0) + 1);
  }
  const byClass: FeeSummaryFacet[] = [...classCounts.entries()]
    .map(([key, count]) => ({
      key,
      label: key === "UNASSIGNED" ? "Unassigned class" : key,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const q = filters.q?.trim().toLowerCase();
  const rows = allStudents
    .filter((row) => {
      if (filters.grade) {
        const gradeKey = row.grade?.trim() || "UNASSIGNED";
        if (gradeKey !== filters.grade.trim()) return false;
      }
      if (filters.className) {
        const classKey = row.className?.trim() || "UNASSIGNED";
        if (classKey !== filters.className.trim()) return false;
      }
      if (filters.statementStatus && row.statementStatus !== filters.statementStatus) {
        return false;
      }
      if (q) {
        const haystack = [
          row.englishName,
          row.chineseName ?? "",
          row.candidateKey,
          row.statementNo ?? "",
          row.className,
          row.grade,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => a.englishName.localeCompare(b.englishName));

  const matchedStudents = [...studentMap.values()].filter((s) =>
    rows.some(
      (r) =>
        r.candidateKey === s.candidateKey &&
        r.registrationWindowId === s.registrationWindowId,
    ),
  );

  const workspacesWithStatement = new Set<string>();
  for (const student of matchedStudents) {
    if (student.workspaceId && latestStatementByWorkspace.has(student.workspaceId)) {
      workspacesWithStatement.add(student.workspaceId);
    }
  }

  const lockedWorkspaceIds = new Set(
    matchedStudents.map((s) => s.workspaceId).filter(Boolean) as string[],
  );

  let paidAmount = 0;
  let unpaidAmount = 0;
  for (const row of rows) {
    if (row.statementStatus === "PAID") paidAmount += row.amountDueGbp;
    else if (row.statementStatus === "ISSUED") unpaidAmount += row.amountDueGbp;
  }

  const cards: FeeSummaryCards = {
    totalCandidates: rows.length,
    totalExamEntries: matchedStudents.reduce((sum, s) => sum + s.examEntryCount, 0),
    totalGbpAmount: Math.round(rows.reduce((sum, row) => sum + row.amountDueGbp, 0) * 100) / 100,
    totalCnyAmount: Math.round(totalCny * 100) / 100,
    paidAmount: Math.round(paidAmount * 100) / 100,
    unpaidAmount: Math.round(unpaidAmount * 100) / 100,
    missingFeeRules: rows.reduce((sum, row) => sum + row.missingFeeRuleCount, 0),
    statementsGenerated: workspacesWithStatement.size,
    statementsNotGenerated: Math.max(0, lockedWorkspaceIds.size - workspacesWithStatement.size),
  };

  const systemTips: string[] = [];
  if (cards.missingFeeRules > 0) {
    systemTips.push(
      `${cards.missingFeeRules} missing fee rule match${cards.missingFeeRules === 1 ? "" : "es"} in the current selection.`,
    );
  }
  if (cards.statementsNotGenerated > 0) {
    systemTips.push(
      `${cards.statementsNotGenerated} candidate${cards.statementsNotGenerated === 1 ? "" : "s"} still need a fee statement.`,
    );
  }
  const needsRegen = rows.filter((row) => row.statementStatus === "NEEDS_REGENERATION").length;
  if (needsRegen > 0) {
    systemTips.push(
      `${needsRegen} statement${needsRegen === 1 ? "" : "s"} need regeneration after registration changes.`,
    );
  }

  return { cards, rows, byGrade, byClass, systemTips };
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
            FeeStatementStatus.ISSUED,
            FeeStatementStatus.PAID,
            FeeStatementStatus.NEEDS_REGENERATION,
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
      candidate: { select: { studentId: true } },
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
      const isCandidateFee = item.serviceType === "CANDIDATE_REGISTRATION";
      if (!item.examSessionId && !isCandidateFee) continue;

      const regMeta = item.examSessionId
        ? matchingRegs.get(item.examSessionId)
        : (statement.registrationWorkspace?.registrations[0] ?? null);

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
        permanentStudentId: statement.candidate?.studentId ?? null,
        studentNumber:
          statement.candidateTypeSnapshot === "INTERNAL" ? statement.studentNoSnapshot : null,
        candidateType: statement.candidateTypeSnapshot,
        grade: statement.gradeSnapshot,
        className: statement.classNameSnapshot,
        registrationSource: regMeta?.registrationSource ?? null,
        visibility: regMeta?.visibility ?? null,
        billingScope: regMeta?.billingScope ?? null,
        examBoardName: statement.registrationWindow?.examBoard.name ?? "",
        examSeriesName: statement.registrationWindow?.examSeries.name ?? "",
        examSeriesYear: statement.registrationWindow?.examSeries.year ?? 0,
        subjectName: isCandidateFee
          ? (item.serviceNameSnapshot ?? CANDIDATE_REGISTRATION_FEE_SERVICE_NAME)
          : (item.subjectSnapshot ?? ""),
        paperCode: isCandidateFee ? "" : (item.paperCodeSnapshot ?? ""),
        paperTitle: isCandidateFee
          ? (item.serviceNameSnapshot ?? CANDIDATE_REGISTRATION_FEE_SERVICE_NAME)
          : (item.paperTitleSnapshot ?? ""),
        entryType: isCandidateFee ? "—" : (item.entryTypeSnapshot ?? "NORMAL"),
        examDate: isCandidateFee ? null : (item.examSession?.date?.toISOString() ?? null),
        costCurrency: showCosts ? item.costCurrencySnapshot : null,
        costAmount: showCosts ? toNumber(item.costAmountSnapshot) : null,
        exchangeRate: item.exchangeRateSnapshot ? toNumber(item.exchangeRateSnapshot) : null,
        markupType: showCosts ? item.markupTypeSnapshot : null,
        markupValue: showCosts && item.markupValueSnapshot ? toNumber(item.markupValueSnapshot) : null,
        salesGbp: toNumber(item.salesGbpAmountSnapshot),
        salesCny: toNumber(item.salesCnyAmountSnapshot),
        statementStatus: statement.status,
        generatedAt: statement.generatedAt.toISOString(),
        registrationWindowTitle: statement.registrationWindow?.title ?? "",
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
      const match = findMatchingFeeRuleWithFallback(rules, {
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
        permanentStudentId: reg.candidate?.studentId ?? null,
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
  permanentStudentId: string | null;
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
    row.permanentStudentId ??
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
        permanentStudentId: row.permanentStudentId,
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
      status: { in: ["DRAFT", "NEEDS_REGENERATION"] },
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
