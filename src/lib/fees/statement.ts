import type { FeeStatementDisplayCurrency } from "@/generated/prisma/enums";
import { calculateFeeAmounts } from "@/lib/fees/calculate";
import {
  buildCandidateRegistrationFeeLine,
  CANDIDATE_REGISTRATION_FEE_SERVICE_NAME,
  candidateRegistrationFeeWarningMessage,
  loadCandidateRegistrationFeeSchedule,
  previewCandidateRegistrationFee,
  validateCandidateRegistrationFeeForWorkspace,
} from "@/lib/fees/candidate-registration-fee";
import { DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY } from "@/lib/fees/display-currency";
import { findMatchingFeeRuleWithFallback, resolveEntryTypeForRegistration } from "@/lib/fees/match";
import type {
  CalculatedFeeLine,
  ExchangeRateRecord,
  FeeRuleRecord,
  MissingFeeRuleWarning,
} from "@/lib/fees/types";
import type { Prisma } from "@/generated/prisma/client";
import type { BillingScope } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AUTO_BILLING_SCOPES } from "@/lib/registrations/metadata";
import {
  feeStatementStudentVisible,
  isOfficeOnlyRegistrationType,
  normalizeRegistrationType,
  statementKindForRegistrationType,
} from "@/lib/registrations/registration-type";
import { generateFeeStatementNumber } from "@/lib/registrations/numbering";
import { createFeeAuditLog } from "@/lib/fees/audit";
import { finalizeRevisedFeeStatement } from "@/lib/fees/statement-lifecycle";

export class FeeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeeError";
  }
}

/** Ensure workspace.lockedAt is set when registrations are already LOCKED. */
export async function ensureWorkspaceLockedForBilling(workspaceId: string) {
  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, lockedAt: true },
  });
  if (!workspace) throw new FeeError("Registration workspace not found");
  if (workspace.lockedAt) return workspace;

  const lockedRegistration = await prisma.studentExamRegistration.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      status: "LOCKED",
      lockedAt: { not: null },
    },
    orderBy: { lockedAt: "desc" },
    select: { lockedAt: true },
  });

  if (!lockedRegistration?.lockedAt) {
    throw new FeeError("Registration workspace is not locked");
  }

  return prisma.registrationWorkspace.update({
    where: { id: workspaceId },
    data: { lockedAt: lockedRegistration.lockedAt },
    select: { id: true, lockedAt: true },
  });
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
  candidateRegistrationFeeWarning: string | null;
  candidateRegistrationFeePreview: Awaited<
    ReturnType<typeof previewCandidateRegistrationFee>
  > | null;
  includeCandidateRegistrationFee: boolean;
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
  await ensureWorkspaceLockedForBilling(workspaceId);

  const rules = await prisma.feeRule.findMany({
    where: { registrationWindowId: workspace.registrationWindowId, isActive: true },
  });

  const exchangeRates = await prisma.exchangeRate.findMany({
    where: { registrationWindowId: workspace.registrationWindowId },
    orderBy: { effectiveDate: "desc" },
  });

  const warnings: MissingFeeRuleWarning[] = [];

  for (const reg of workspace.registrations) {
    const qualificationId = reg.subject.qualificationId;
    const entryType = resolveEntryTypeForRegistration(reg, workspace);
    const match = findMatchingFeeRuleWithFallback(rules, {
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

  const feeValidation = await validateCandidateRegistrationFeeForWorkspace(workspaceId);
  const candidateRegistrationFeeWarning = candidateRegistrationFeeWarningMessage(feeValidation);
  const candidateRegistrationFeePreview = workspace.includeCandidateRegistrationFee
    ? await previewCandidateRegistrationFee(
        workspace.registrationWindow.examBoardId,
        workspace.registrationWindowId,
      )
    : null;

  return {
    warnings,
    canGenerate: warnings.length === 0 && !candidateRegistrationFeeWarning,
    candidateRegistrationFeeWarning,
    candidateRegistrationFeePreview,
    includeCandidateRegistrationFee: workspace.includeCandidateRegistrationFee,
  };
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
  await ensureWorkspaceLockedForBilling(workspaceId);

  const rules = await prisma.feeRule.findMany({
    where: { registrationWindowId: workspace.registrationWindowId, isActive: true },
  });

  const exchangeRates: ExchangeRateRecord[] = await prisma.exchangeRate.findMany({
    where: { registrationWindowId: workspace.registrationWindowId },
    orderBy: { effectiveDate: "desc" },
  });

  const lines: CalculatedFeeLine[] = [];
  const warnings: MissingFeeRuleWarning[] = [];
  let exchangeRateSnapshot: number | null = null;

  for (const reg of workspace.registrations) {
    const qualificationId = reg.subject.qualificationId;
    const entryType = resolveEntryTypeForRegistration(reg, workspace);
    const rule = findMatchingFeeRuleWithFallback(rules, {
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

  if (workspace.includeCandidateRegistrationFee) {
    const schedule = await loadCandidateRegistrationFeeSchedule(
      workspace.registrationWindow.examBoardId,
    );
    if (!schedule) {
      warnings.push({
        examSessionId: "",
        subject: CANDIDATE_REGISTRATION_FEE_SERVICE_NAME,
        paperCode: "",
        paperTitle: "",
        entryType: "NORMAL",
      });
    } else {
      lines.push(
        buildCandidateRegistrationFeeLine(
          schedule,
          workspace.registrationWindow.examBoard.code,
          exchangeRates,
          displayCurrency,
        ),
      );
      if (exchangeRateSnapshot === null) {
        exchangeRateSnapshot = lines[lines.length - 1]!.exchangeRateSnapshot ?? null;
      }
    }
  }

  return { lines, exchangeRateSnapshot, warnings };
}

export {
  markFeeStatementsNeedsRegeneration,
  loadFeeStatementVersionHistory,
  feeStatementChangeReasonLabel,
  type FeeStatementChangeReasonCode,
} from "@/lib/fees/statement-lifecycle";

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

export async function regenerateRevisedFeeStatement(params: {
  workspaceId: string;
  generatedByUserId: string;
  displayCurrency?: FeeStatementDisplayCurrency;
}) {
  return generateFeeStatement({
    ...params,
    regenerate: true,
    issue: true,
  });
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
    issue: issueRequested = false,
    regenerate: regenerateRequested = false,
  } = params;
  let regenerate = regenerateRequested;
  let issue = issueRequested;

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
  const registrationType = normalizeRegistrationType(workspace.registrationType);
  if (isOfficeOnlyRegistrationType(registrationType)) {
    throw new FeeError(
      "Restricted and external registrations use a separate fee statement instead of a normal fee statement",
    );
  }
  await ensureWorkspaceLockedForBilling(workspaceId);

  const existingDraft = await prisma.feeStatement.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      status: { in: ["DRAFT", "NEEDS_REGENERATION"] },
    },
  });

  if (existingDraft && !regenerate) {
    if (existingDraft.status === "NEEDS_REGENERATION") {
      throw new FeeError(
        "The fee statement is outdated after a registration change. Use Regenerate Revised Statement.",
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
      "An issued fee statement already exists. Use Regenerate Revised Statement.",
    );
  }

  const needsRegenerationStatement = await prisma.feeStatement.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      status: "NEEDS_REGENERATION",
    },
    orderBy: { generatedAt: "desc" },
  });

  const onlySuperseded =
    !existingDraft &&
    !existingIssued &&
    !needsRegenerationStatement &&
    (await prisma.feeStatement.findFirst({
      where: {
        registrationWorkspaceId: workspaceId,
        statementKind: "NORMAL",
        status: "REVISED",
      },
      select: { id: true },
    }));
  if (onlySuperseded) {
    regenerate = true;
  }

  if (regenerate && needsRegenerationStatement && !issue) {
    issue = true;
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

  if (regenerate && existingDraft && existingDraft.status === "DRAFT" && !existingDraft.issuedAt) {
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

  const statementNo = await generateFeeStatementNumber(registrationType);
  const statementKind = statementKindForRegistrationType(registrationType);

  const statement = await prisma.feeStatement.create({
    data: {
      candidateId: workspace.candidateId ?? candidate?.id ?? null,
      studentId: workspace.studentId,
      registrationWorkspaceId: workspaceId,
      registrationWindowId: workspace.registrationWindowId,
      statementNo,
      statementKind,
      studentVisible: feeStatementStudentVisible(registrationType),
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
        create: lines.map((line) => mapFeeLineToStatementItemCreate(line)),
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

  if (regenerate) {
    await finalizeRevisedFeeStatement({
      workspaceId,
      newStatementId: statement.id,
      performedByUserId: generatedByUserId,
      registrationWindowId: workspace.registrationWindowId,
    });
  }

  if (issue) {
    await createFeeAuditLog({
      action: "FEE_STATEMENT_ISSUED",
      performedByUserId: generatedByUserId,
      registrationWindowId: workspace.registrationWindowId,
      metadata: { statementId: statement.id, statementNo: statement.statementNo, regenerate },
    }).catch((error) => {
      console.error("Fee audit log failed:", error);
    });
  }

  return statement;
}

function billableRegistrationFilter(includeManual = false): Prisma.StudentExamRegistrationWhereInput {
  return {
    registrationType: "INTERNAL_NORMAL",
    billingScope: {
      in: includeManual
        ? (["NORMAL_BILLING", "MANUAL_REVIEW"] as BillingScope[])
        : [...AUTO_BILLING_SCOPES],
    },
  };
}

function mapFeeLineToStatementItemCreate(
  line: CalculatedFeeLine,
): Prisma.FeeStatementItemCreateWithoutFeeStatementInput {
  const item: Prisma.FeeStatementItemCreateWithoutFeeStatementInput = {
    serviceType: line.serviceType ?? null,
    feeScheduleVersionSnapshot: line.feeScheduleVersionSnapshot ?? null,
    serviceNameSnapshot: line.serviceNameSnapshot ?? null,
    examBoardSnapshot: line.examBoardSnapshot,
    qualificationSnapshot: line.qualificationSnapshot ?? null,
    subjectSnapshot: line.subjectSnapshot ?? null,
    paperCodeSnapshot: line.paperCodeSnapshot ?? null,
    paperTitleSnapshot: line.paperTitleSnapshot ?? null,
    entryTypeSnapshot: line.entryTypeSnapshot ?? null,
    costCurrencySnapshot: line.costCurrencySnapshot,
    costAmountSnapshot: line.costAmountSnapshot,
    exchangeRateSnapshot: line.exchangeRateSnapshot,
    markupTypeSnapshot: line.markupTypeSnapshot ?? null,
    markupValueSnapshot: line.markupValueSnapshot,
    salesGbpAmountSnapshot: line.salesGbpAmountSnapshot,
    salesCnyAmountSnapshot: line.salesCnyAmountSnapshot,
    displayCurrencySnapshot: line.displayCurrencySnapshot,
    lineTotalGbp: line.lineTotalGbp,
    lineTotalCny: line.lineTotalCny,
    quantity: line.quantity,
  };

  if (line.feeScheduleId) {
    item.feeSchedule = { connect: { id: line.feeScheduleId } };
  }
  if (line.examSessionId) {
    item.examSession = { connect: { id: line.examSessionId } };
  }

  return item;
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
  if (statement.status === "NEEDS_REGENERATION") {
    throw new FeeError("Cannot issue an outdated statement. Regenerate a revised statement instead.");
  }
  if (statement.items.length === 0) {
    throw new FeeError("Fee statement has no line items");
  }

  if (!statement.registrationWorkspaceId) {
    throw new FeeError("Cannot issue registration fee statement without a workspace");
  }

  const validation = await validateWorkspaceFees(statement.registrationWorkspaceId);
  if (!validation.canGenerate) {
    const parts: string[] = [];
    if (validation.warnings.length > 0) {
      parts.push(`missing fee rules for ${validation.warnings.length} exam(s)`);
    }
    if (validation.candidateRegistrationFeeWarning) {
      parts.push(validation.candidateRegistrationFeeWarning);
    }
    throw new FeeError(`Cannot issue: ${parts.join("; ")}.`);
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
