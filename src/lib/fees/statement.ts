import type { FeeStatementDisplayCurrency } from "@/generated/prisma/enums";
import { calculateFeeAmounts } from "@/lib/fees/calculate";
import { DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY } from "@/lib/fees/display-currency";
import { findMatchingFeeRule, resolveEntryTypeForWorkspace } from "@/lib/fees/match";
import type {
  CalculatedFeeLine,
  ExchangeRateRecord,
  FeeRuleRecord,
  MissingFeeRuleWarning,
} from "@/lib/fees/types";
import type { BillingScope } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AUTO_BILLING_SCOPES } from "@/lib/registrations/metadata";

export class FeeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeeError";
  }
}

async function loadQualificationId(subjectId: string): Promise<string> {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { qualificationId: true },
  });
  if (!subject) throw new FeeError("Subject not found");
  return subject.qualificationId;
}

export async function validateWorkspaceFees(workspaceId: string): Promise<{
  warnings: MissingFeeRuleWarning[];
  canGenerate: boolean;
}> {
  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      registrationWindow: true,
      registrations: {
        where: {
          status: { in: ["ACTIVE", "LOCKED"] },
          ...billableRegistrationFilter(),
        },
        include: {
          subject: { select: { name: true, qualificationId: true } },
          paper: { select: { code: true, title: true } },
        },
      },
    },
  });

  if (!workspace) throw new FeeError("Registration workspace not found");
  if (!workspace.lockedAt) throw new FeeError("Registration workspace is not locked");

  const rules = await prisma.feeRule.findMany({
    where: { registrationWindowId: workspace.registrationWindowId, isActive: true },
  });

  const exchangeRates = await prisma.exchangeRate.findMany({
    where: { registrationWindowId: workspace.registrationWindowId },
    orderBy: { effectiveDate: "desc" },
  });

  const entryType = resolveEntryTypeForWorkspace(workspace.isLateRegistration);
  const warnings: MissingFeeRuleWarning[] = [];

  for (const reg of workspace.registrations) {
    const qualificationId = reg.subject.qualificationId;
    const match = findMatchingFeeRule(rules, {
      examBoardId: reg.examBoardId,
      examSeriesId: reg.examSeriesId,
      qualificationId,
      subjectId: reg.subjectId,
      paperId: reg.paperId,
      examSessionId: reg.examSessionId,
      entryType,
    });

    if (!match) {
      warnings.push({
        examSessionId: reg.examSessionId,
        subject: reg.subject.name,
        paperCode: reg.paper.code,
        paperTitle: reg.paper.title,
        entryType,
      });
    } else {
      calculateFeeAmounts(match, exchangeRates);
    }
  }

  return { warnings, canGenerate: warnings.length === 0 };
}

export async function buildFeeLinesForWorkspace(
  workspaceId: string,
  displayCurrency: FeeStatementDisplayCurrency = DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
): Promise<{
  lines: CalculatedFeeLine[];
  exchangeRateSnapshot: number | null;
  warnings: MissingFeeRuleWarning[];
}> {
  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      registrationWindow: {
        include: {
          examBoard: { select: { name: true, code: true } },
          examSeries: { select: { name: true, year: true } },
        },
      },
      registrations: {
        where: {
          status: { in: ["ACTIVE", "LOCKED"] },
          ...billableRegistrationFilter(),
        },
        include: {
          subject: {
            include: { qualification: { select: { name: true, level: true } } },
          },
          paper: { select: { code: true, title: true } },
          examBoard: { select: { name: true, code: true } },
        },
      },
    },
  });

  if (!workspace) throw new FeeError("Registration workspace not found");
  if (!workspace.lockedAt) throw new FeeError("Registration workspace is not locked");

  const rules = await prisma.feeRule.findMany({
    where: { registrationWindowId: workspace.registrationWindowId, isActive: true },
  });

  const exchangeRates: ExchangeRateRecord[] = await prisma.exchangeRate.findMany({
    where: { registrationWindowId: workspace.registrationWindowId },
    orderBy: { effectiveDate: "desc" },
  });

  const entryType = resolveEntryTypeForWorkspace(workspace.isLateRegistration);
  const lines: CalculatedFeeLine[] = [];
  const warnings: MissingFeeRuleWarning[] = [];
  let exchangeRateSnapshot: number | null = null;

  for (const reg of workspace.registrations) {
    const qualificationId = reg.subject.qualificationId;
    const rule = findMatchingFeeRule(rules, {
      examBoardId: reg.examBoardId,
      examSeriesId: reg.examSeriesId,
      qualificationId,
      subjectId: reg.subjectId,
      paperId: reg.paperId,
      examSessionId: reg.examSessionId,
      entryType,
    });

    if (!rule) {
      warnings.push({
        examSessionId: reg.examSessionId,
        subject: reg.subject.name,
        paperCode: reg.paper.code,
        paperTitle: reg.paper.title,
        entryType,
      });
      continue;
    }

    const amounts = calculateFeeAmounts(rule as FeeRuleRecord, exchangeRates);
    if (exchangeRateSnapshot === null) {
      exchangeRateSnapshot = amounts.exchangeRateGbpToCny;
    }

    lines.push({
      examSessionId: reg.examSessionId,
      examBoardSnapshot: reg.examBoard.code,
      qualificationSnapshot: `${reg.subject.qualification.name} (${reg.subject.qualification.level})`,
      subjectSnapshot: reg.subject.name,
      paperCodeSnapshot: reg.paper.code,
      paperTitleSnapshot: reg.paper.title,
      entryTypeSnapshot: entryType,
      costCurrencySnapshot: rule.costCurrency,
      costAmountSnapshot: Number(rule.costAmount),
      exchangeRateSnapshot: amounts.exchangeRateGbpToCny,
      markupTypeSnapshot: rule.markupType,
      markupValueSnapshot: rule.markupValue ? Number(rule.markupValue) : null,
      salesGbpAmountSnapshot: amounts.salesGbp,
      salesCnyAmountSnapshot: amounts.salesCny,
      displayCurrencySnapshot: displayCurrency,
      lineTotalGbp: amounts.salesGbp,
      lineTotalCny: amounts.salesCny,
      quantity: 1,
      feeRuleId: rule.id,
    });
  }

  return { lines, exchangeRateSnapshot, warnings };
}

export async function generateStatementNumber(registrationWindowId: string): Promise<string> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    include: { examBoard: { select: { code: true } }, examSeries: { select: { year: true } } },
  });
  if (!window) throw new FeeError("Registration window not found");

  const prefix = `FS-${window.examBoard.code}-${window.examSeries.year}`;
  const count = await prisma.feeStatement.count({
    where: { registrationWindowId },
  });
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

export async function markSupersededStatements(workspaceId: string): Promise<void> {
  await prisma.feeStatement.updateMany({
    where: {
      registrationWorkspaceId: workspaceId,
      status: { in: ["ISSUED", "PAID"] },
    },
    data: { status: "REVISED" },
  });
}

export async function markStatementsNeedReview(workspaceId: string): Promise<void> {
  await prisma.feeStatement.updateMany({
    where: {
      registrationWorkspaceId: workspaceId,
      status: "DRAFT",
    },
    data: { status: "NEEDS_REVIEW" },
  });
}

function billableRegistrationFilter(includeManual = false): { billingScope: { in: BillingScope[] } } {
  if (includeManual) {
    return {
      billingScope: { in: ["NORMAL_BILLING", "OFFICE_ONLY_BILLING", "MANUAL_REVIEW"] },
    };
  }
  return { billingScope: { in: [...AUTO_BILLING_SCOPES] } };
}

export async function generateFeeStatement(params: {
  workspaceId: string;
  generatedByUserId: string;
  displayCurrency?: FeeStatementDisplayCurrency;
  issue?: boolean;
  regenerate?: boolean;
}) {
  const {
    workspaceId,
    generatedByUserId,
    displayCurrency = DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
    issue = false,
    regenerate = false,
  } = params;

  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      candidate: true,
      student: { include: { studentProfile: true } },
      registrationWindow: true,
      registrations: {
        where: {
          status: { in: ["ACTIVE", "LOCKED"] },
          ...billableRegistrationFilter(),
        },
        take: 1,
      },
    },
  });

  if (!workspace) throw new FeeError("Registration workspace not found");
  if (!workspace.lockedAt) throw new FeeError("Registration workspace is not locked");

  const existingDraft = await prisma.feeStatement.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      status: { in: ["DRAFT", "NEEDS_REVIEW"] },
    },
  });

  if (existingDraft && !regenerate) {
    if (existingDraft.status === "NEEDS_REVIEW") {
      throw new FeeError(
        "The fee statement is out of date after a registration change. Use regenerate to create a revised statement.",
      );
    }
    throw new FeeError("A draft fee statement already exists. Issue or regenerate it.");
  }

  const existingIssued = await prisma.feeStatement.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      status: { in: ["ISSUED", "PAID"] },
    },
  });

  if (existingIssued && !regenerate) {
    throw new FeeError(
      "An issued fee statement already exists. Use regenerate to create a revised statement.",
    );
  }

  const { lines, exchangeRateSnapshot, warnings } = await buildFeeLinesForWorkspace(
    workspaceId,
    displayCurrency,
  );

  if (warnings.length > 0) {
    throw new FeeError(
      `Missing fee rules for ${warnings.length} exam(s). Configure fee rules before generating.`,
    );
  }

  if (regenerate && existingIssued) {
    await markSupersededStatements(workspaceId);
  }

  if (existingDraft && regenerate) {
    await prisma.feeStatementItem.deleteMany({ where: { feeStatementId: existingDraft.id } });
    await prisma.feeStatement.delete({ where: { id: existingDraft.id } });
  }

  const totalGbp = lines.reduce((sum, line) => sum + line.lineTotalGbp, 0);
  const totalCny = lines.reduce((sum, line) => sum + line.lineTotalCny, 0);
  const snapshot = workspace.registrations[0] ?? null;
  const candidate = workspace.candidate;
  const profile = workspace.student?.studentProfile;
  const studentName =
    snapshot?.studentNameSnapshot ??
    candidate?.englishName ??
    workspace.student?.name ??
    "";
  const studentNo =
    snapshot?.studentNoSnapshot ??
    candidate?.studentNumber ??
    profile?.studentNo ??
    candidate?.assessmentHubCandidateNumber ??
    "";
  const grade =
    snapshot?.gradeSnapshot ?? candidate?.grade ?? profile?.currentGrade ?? "";
  const className =
    snapshot?.classNameSnapshot ??
    candidate?.className ??
    profile?.currentClassName ??
    "";
  const email =
    snapshot?.emailSnapshot ??
    candidate?.email ??
    profile?.email ??
    workspace.student?.email ??
    null;
  const assessmentHubCandidateNumber =
    snapshot?.assessmentHubCandidateNumberSnapshot ??
    candidate?.assessmentHubCandidateNumber ??
    null;
  const candidateType =
    snapshot?.candidateTypeSnapshot ?? candidate?.candidateType ?? null;

  const statementNo = await generateStatementNumber(workspace.registrationWindowId);

  const statement = await prisma.feeStatement.create({
    data: {
      candidateId: workspace.candidateId ?? candidate?.id ?? null,
      studentId: workspace.studentId,
      registrationWorkspaceId: workspaceId,
      registrationWindowId: workspace.registrationWindowId,
      statementNo,
      displayCurrency,
      exchangeRateSnapshot,
      studentNameSnapshot: studentName,
      studentNoSnapshot: studentNo,
      gradeSnapshot: grade,
      classNameSnapshot: className,
      emailSnapshot: email,
      assessmentHubCandidateNumberSnapshot: assessmentHubCandidateNumber,
      candidateTypeSnapshot: candidateType,
      status: issue ? "ISSUED" : "DRAFT",
      totalGbpAmount: totalGbp,
      totalCnyAmount: totalCny,
      generatedByUserId,
      issuedAt: issue ? new Date() : null,
      items: {
        create: lines.map((line) => ({
          examSessionId: line.examSessionId,
          examBoardSnapshot: line.examBoardSnapshot,
          qualificationSnapshot: line.qualificationSnapshot,
          subjectSnapshot: line.subjectSnapshot,
          paperCodeSnapshot: line.paperCodeSnapshot,
          paperTitleSnapshot: line.paperTitleSnapshot,
          entryTypeSnapshot: line.entryTypeSnapshot,
          costCurrencySnapshot: line.costCurrencySnapshot,
          costAmountSnapshot: line.costAmountSnapshot,
          exchangeRateSnapshot: line.exchangeRateSnapshot,
          markupTypeSnapshot: line.markupTypeSnapshot,
          markupValueSnapshot: line.markupValueSnapshot,
          salesGbpAmountSnapshot: line.salesGbpAmountSnapshot,
          salesCnyAmountSnapshot: line.salesCnyAmountSnapshot,
          displayCurrencySnapshot: line.displayCurrencySnapshot,
          lineTotalGbp: line.lineTotalGbp,
          lineTotalCny: line.lineTotalCny,
          quantity: line.quantity,
        })),
      },
    },
    include: {
      items: true,
      registrationWindow: {
        include: {
          examBoard: { select: { name: true, code: true } },
          examSeries: { select: { name: true, year: true } },
        },
      },
    },
  });

  return statement;
}

export async function issueFeeStatement(statementId: string) {
  const statement = await prisma.feeStatement.findUnique({
    where: { id: statementId },
    include: { items: true },
  });

  if (!statement) throw new FeeError("Fee statement not found");
  if (statement.status === "ISSUED" || statement.status === "PAID") {
    throw new FeeError("Fee statement is already issued");
  }
  if (statement.status === "REVISED" || statement.status === "CANCELLED") {
    throw new FeeError("Cannot issue a revised or cancelled statement");
  }
  if (statement.items.length === 0) {
    throw new FeeError("Fee statement has no line items");
  }

  const validation = await validateWorkspaceFees(statement.registrationWorkspaceId);
  if (!validation.canGenerate) {
    throw new FeeError(
      `Cannot issue: missing fee rules for ${validation.warnings.length} exam(s).`,
    );
  }

  return prisma.feeStatement.update({
    where: { id: statementId },
    data: { status: "ISSUED", issuedAt: new Date() },
    include: {
      items: true,
      registrationWindow: {
        include: {
          examBoard: { select: { name: true, code: true } },
          examSeries: { select: { name: true, year: true } },
        },
      },
    },
  });
}

export { loadQualificationId };
