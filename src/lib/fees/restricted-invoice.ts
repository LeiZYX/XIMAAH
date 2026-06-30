import type {
  FeeStatementDisplayCurrency,
  FeeStatementKind,
  RegistrationType,
} from "@/generated/prisma/enums";
import { calculateFeeAmounts } from "@/lib/fees/calculate";
import { DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY } from "@/lib/fees/display-currency";
import { findMatchingFeeRuleWithFallback } from "@/lib/fees/match";
import type { ExchangeRateRecord, FeeRuleRecord } from "@/lib/fees/types";
import { FeeError, issueFeeStatement, ensureWorkspaceLockedForBilling } from "@/lib/fees/statement";
import { centreInfoFromExamBoard } from "@/lib/exam-boards/centre";
import { prisma } from "@/lib/prisma";

const OFFICE_INVOICE_CONFIG: Record<
  "RESTRICTED" | "EXTERNAL",
  { registrationType: RegistrationType; statementKind: FeeStatementKind; numberPrefix: string; label: string }
> = {
  RESTRICTED: {
    registrationType: "RESTRICTED",
    statementKind: "RESTRICTED",
    numberPrefix: "RINV",
    label: "restricted invoice",
  },
  EXTERNAL: {
    registrationType: "EXTERNAL",
    statementKind: "EXTERNAL",
    numberPrefix: "EINV",
    label: "external invoice",
  },
};

export async function generateOfficeInvoiceNumber(
  registrationWindowId: string,
  statementKind: "RESTRICTED" | "EXTERNAL",
  numberPrefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.feeStatement.count({
    where: { registrationWindowId, statementKind },
  });
  return `${numberPrefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateOfficeInvoice(params: {
  workspaceId: string;
  generatedByUserId: string;
  kind: "RESTRICTED" | "EXTERNAL";
  displayCurrency?: FeeStatementDisplayCurrency;
  issue?: boolean;
}) {
  const {
    workspaceId,
    generatedByUserId,
    kind,
    displayCurrency = DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
    issue = false,
  } = params;

  const config = OFFICE_INVOICE_CONFIG[kind];

  const existingDraft = await prisma.feeStatement.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      statementKind: config.statementKind,
      status: "DRAFT",
    },
    include: {
      items: true,
      registrationWindow: { include: { examBoard: true } },
    },
  });

  if (existingDraft) {
    if (issue) {
      const issued = await issueFeeStatement(existingDraft.id);
      const centre = centreInfoFromExamBoard(existingDraft.registrationWindow.examBoard);
      return { ...issued, centre };
    }
    throw new FeeError(`A draft ${config.label} already exists for this registration`);
  }

  const existingIssued = await prisma.feeStatement.findFirst({
    where: {
      registrationWorkspaceId: workspaceId,
      statementKind: config.statementKind,
      status: { in: ["ISSUED", "PAID"] },
    },
    include: {
      items: true,
      registrationWindow: { include: { examBoard: true } },
    },
  });

  if (existingIssued) {
    if (issue) {
      const centre = centreInfoFromExamBoard(existingIssued.registrationWindow.examBoard);
      return { ...existingIssued, centre };
    }
    throw new FeeError(`An issued ${config.label} already exists for this registration`);
  }

  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      candidate: true,
      student: { include: { studentProfile: true } },
      registrationWindow: true,
    },
  });

  if (!workspace) throw new FeeError("Registration workspace not found");
  if (workspace.registrationType !== config.registrationType) {
    throw new FeeError(`This workspace is not a ${kind.toLowerCase()} registration`);
  }
  await ensureWorkspaceLockedForBilling(workspaceId);

  const registrations = await prisma.studentExamRegistration.findMany({
    where: {
      registrationWorkspaceId: workspaceId,
      status: { in: ["ACTIVE", "LOCKED"] },
      registrationType: config.registrationType,
    },
    include: {
      subject: { include: { qualification: { select: { id: true, name: true, level: true } } } },
      paper: { select: { code: true, title: true } },
      examBoard: {
        select: {
          code: true,
          name: true,
          centreName: true,
          centreNumber: true,
          centreAddress: true,
          centreEmail: true,
          centrePhone: true,
          centreCountry: true,
          centreTimeZone: true,
          timezone: true,
          defaultExamOfficerName: true,
          defaultExamOfficerEmail: true,
        },
      },
    },
  });

  if (registrations.length === 0) {
    throw new FeeError(`No ${config.label} registrations found for this workspace`);
  }

  const rules = await prisma.feeRule.findMany({
    where: { registrationWindowId: workspace.registrationWindowId, isActive: true },
  });
  const exchangeRates: ExchangeRateRecord[] = await prisma.exchangeRate.findMany({
    where: { registrationWindowId: workspace.registrationWindowId },
    orderBy: { effectiveDate: "desc" },
  });

  const lines = [];
  for (const reg of registrations) {
    const entryType = reg.entryType;
    const rule = findMatchingFeeRuleWithFallback(rules, {
      examBoardId: reg.examBoardId,
      examSeriesId: reg.examSeriesId,
      qualificationId: reg.subject.qualificationId,
      subjectId: reg.subjectId,
      paperId: reg.paperId,
      examSessionId: reg.examSessionId,
      entryType,
    });
    if (!rule) {
      throw new FeeError(`Missing fee rule for ${reg.paper.code}`);
    }
    const amounts = calculateFeeAmounts(rule as FeeRuleRecord, exchangeRates);
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
    });
  }

  const snapshot = registrations[0]!;
  const statementNo = await generateOfficeInvoiceNumber(
    workspace.registrationWindowId,
    kind,
    config.numberPrefix,
  );
  const totalGbp = lines.reduce((sum, line) => sum + line.lineTotalGbp, 0);
  const totalCny = lines.reduce((sum, line) => sum + line.lineTotalCny, 0);

  const statement = await prisma.feeStatement.create({
    data: {
      candidateId: workspace.candidateId,
      studentId: workspace.studentId,
      registrationWorkspaceId: workspaceId,
      registrationWindowId: workspace.registrationWindowId,
      statementNo,
      statementKind: config.statementKind,
      displayCurrency,
      exchangeRateSnapshot: lines[0]?.exchangeRateSnapshot ?? null,
      studentNameSnapshot: snapshot.studentNameSnapshot,
      studentNoSnapshot: snapshot.studentNoSnapshot,
      gradeSnapshot: snapshot.gradeSnapshot,
      classNameSnapshot: snapshot.classNameSnapshot,
      emailSnapshot: snapshot.emailSnapshot,
      assessmentHubCandidateNumberSnapshot: snapshot.assessmentHubCandidateNumberSnapshot,
      candidateTypeSnapshot: snapshot.candidateTypeSnapshot,
      status: issue ? "ISSUED" : "DRAFT",
      totalGbpAmount: totalGbp,
      totalCnyAmount: totalCny,
      generatedByUserId,
      issuedAt: issue ? new Date() : null,
      items: { create: lines },
    },
    include: { items: true, registrationWindow: { include: { examBoard: true } } },
  });

  const centre = centreInfoFromExamBoard(statement.registrationWindow.examBoard);

  return { ...statement, centre };
}

export function generateRestrictedInvoice(params: {
  workspaceId: string;
  generatedByUserId: string;
  displayCurrency?: FeeStatementDisplayCurrency;
  issue?: boolean;
}) {
  return generateOfficeInvoice({ ...params, kind: "RESTRICTED" });
}

export function generateExternalInvoice(params: {
  workspaceId: string;
  generatedByUserId: string;
  displayCurrency?: FeeStatementDisplayCurrency;
  issue?: boolean;
}) {
  return generateOfficeInvoice({ ...params, kind: "EXTERNAL" });
}

/** @deprecated */
export const generateRestrictedInvoiceNumber = (
  registrationWindowId: string,
) => generateOfficeInvoiceNumber(registrationWindowId, "RESTRICTED", "RINV");
