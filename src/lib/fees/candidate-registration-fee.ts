import type { FeeCurrency, FeeMarkupType } from "@/generated/prisma/enums";
import { CANDIDATE_REGISTRATION_FEE_SERVICE_NAME } from "@/lib/fees/candidate-registration-fee-constants";
import { calculateFeeAmounts } from "@/lib/fees/calculate";
import { findActiveFeeSchedule } from "@/lib/fees/fee-schedule";
import { toNumber } from "@/lib/fees/money";
import type {
  CalculatedFeeLine,
  ExchangeRateRecord,
} from "@/lib/fees/types";
import type { FeeStatementDisplayCurrency } from "@/generated/prisma/enums";
import { RegistrationAuditAction } from "@/generated/prisma/enums";
import type { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createRegistrationAuditLog } from "@/lib/registrations/audit";
import { markFeeStatementsNeedsRegeneration } from "@/lib/fees/statement";

export { CANDIDATE_REGISTRATION_FEE_SERVICE_NAME } from "@/lib/fees/candidate-registration-fee-constants";

type FeeScheduleRow = NonNullable<Awaited<ReturnType<typeof findActiveFeeSchedule>>>;

export function calculateFeeScheduleAmounts(
  schedule: FeeScheduleRow,
  exchangeRates: ExchangeRateRecord[],
) {
  return calculateFeeAmounts(
    {
      id: schedule.id,
      registrationWindowId: "",
      examBoardId: schedule.examBoardId,
      examSeriesId: "",
      qualificationId: "",
      subjectId: null,
      paperId: null,
      examSessionId: null,
      entryType: "NORMAL",
      costCurrency: schedule.costCurrency as FeeCurrency,
      costAmount: schedule.costAmount,
      exchangeRateToCny: schedule.exchangeRateToCny,
      markupType: (schedule.markupType ?? "MANUAL") as FeeMarkupType,
      markupValue: schedule.markupValue,
      salesCurrency: schedule.salesCurrency as FeeCurrency,
      salesAmount: schedule.salesAmount,
      isActive: true,
    },
    exchangeRates,
  );
}

export function buildCandidateRegistrationFeeLine(
  schedule: FeeScheduleRow,
  examBoardCode: string,
  exchangeRates: ExchangeRateRecord[],
  displayCurrency: FeeStatementDisplayCurrency,
): CalculatedFeeLine {
  const amounts = calculateFeeScheduleAmounts(schedule, exchangeRates);

  return {
    examSessionId: null,
    serviceType: "CANDIDATE_REGISTRATION",
    serviceNameSnapshot: CANDIDATE_REGISTRATION_FEE_SERVICE_NAME,
    feeScheduleId: schedule.id,
    feeScheduleVersionSnapshot: schedule.version,
    examBoardSnapshot: examBoardCode,
    costCurrencySnapshot: schedule.costCurrency as FeeCurrency,
    costAmountSnapshot: toNumber(schedule.costAmount),
    exchangeRateSnapshot: amounts.exchangeRateGbpToCny,
    markupTypeSnapshot: schedule.markupType ?? undefined,
    markupValueSnapshot: schedule.markupValue ? toNumber(schedule.markupValue) : null,
    salesGbpAmountSnapshot: amounts.salesGbp,
    salesCnyAmountSnapshot: amounts.salesCny,
    displayCurrencySnapshot: displayCurrency,
    lineTotalGbp: amounts.salesGbp,
    lineTotalCny: amounts.salesCny,
    quantity: 1,
    feeRuleId: null,
  };
}

export async function loadCandidateRegistrationFeeSchedule(examBoardId: string) {
  return findActiveFeeSchedule({
    examBoardId,
    serviceType: "CANDIDATE_REGISTRATION",
  });
}

export interface CandidateRegistrationFeePreview {
  serviceName: string;
  examBoardName: string;
  salesGbp: number;
  salesCny: number;
  costCurrency: string;
  costAmount: number;
  salesCurrency: string;
  salesAmount: number;
  version: number;
  feeScheduleId: string;
}

export async function previewCandidateRegistrationFee(
  examBoardId: string,
  registrationWindowId: string,
): Promise<CandidateRegistrationFeePreview | null> {
  const schedule = await loadCandidateRegistrationFeeSchedule(examBoardId);
  if (!schedule) return null;

  const [exchangeRates, examBoard] = await Promise.all([
    prisma.exchangeRate.findMany({
      where: { registrationWindowId },
      orderBy: { effectiveDate: "desc" },
    }),
    prisma.examBoard.findUnique({
      where: { id: examBoardId },
      select: { name: true },
    }),
  ]);

  const amounts = calculateFeeScheduleAmounts(schedule, exchangeRates);

  return {
    serviceName: CANDIDATE_REGISTRATION_FEE_SERVICE_NAME,
    examBoardName: examBoard?.name ?? "",
    salesGbp: amounts.salesGbp,
    salesCny: amounts.salesCny,
    costCurrency: schedule.costCurrency,
    costAmount: toNumber(schedule.costAmount),
    salesCurrency: schedule.salesCurrency,
    salesAmount: toNumber(schedule.salesAmount),
    version: schedule.version,
    feeScheduleId: schedule.id,
  };
}

export async function applyCandidateRegistrationFeeSelection(params: {
  workspaceId: string;
  includeCandidateRegistrationFee: boolean;
  performedBy: { id: string; role: UserRole };
  reason?: string | null;
  tx?: Parameters<typeof createRegistrationAuditLog>[1];
}) {
  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: params.workspaceId },
    select: {
      id: true,
      candidateId: true,
      studentId: true,
      registrationType: true,
      includeCandidateRegistrationFee: true,
      registrationWindow: {
        select: { id: true, examBoardId: true },
      },
    },
  });

  if (!workspace) {
    throw new Error("Registration workspace not found");
  }

  const previous = workspace.includeCandidateRegistrationFee;
  const next = params.includeCandidateRegistrationFee;

  if (previous === next) {
    return workspace;
  }

  const feePreview = next
    ? await previewCandidateRegistrationFee(
        workspace.registrationWindow.examBoardId,
        workspace.registrationWindow.id,
      )
    : null;

  const auditSnapshot = (included: boolean) => ({
    status: included ? "ADDED" : "NOT_ADDED",
    includeCandidateRegistrationFee: included,
  });

  const run = async (tx: NonNullable<Parameters<typeof createRegistrationAuditLog>[1]>) => {
    const updated = await tx.registrationWorkspace.update({
      where: { id: workspace.id },
      data: { includeCandidateRegistrationFee: next },
    });

    await createRegistrationAuditLog(
      {
        registrationWorkspaceId: workspace.id,
        registrationWindowId: workspace.registrationWindow.id,
        candidateId: workspace.candidateId,
        studentId: workspace.studentId,
        examSessionId: null,
        action: next
          ? RegistrationAuditAction.CANDIDATE_REGISTRATION_FEE_ADDED
          : RegistrationAuditAction.CANDIDATE_REGISTRATION_FEE_REMOVED,
        performedById: params.performedBy.id,
        performedByRole: params.performedBy.role,
        registrationType: workspace.registrationType,
        reason: params.reason ?? undefined,
        note: CANDIDATE_REGISTRATION_FEE_SERVICE_NAME,
        beforeValue: auditSnapshot(previous),
        afterValue: {
          ...auditSnapshot(next),
          examBoardId: workspace.registrationWindow.examBoardId,
          feeScheduleId: feePreview?.feeScheduleId ?? null,
          feeScheduleVersion: feePreview?.version ?? null,
          salesGbp: feePreview?.salesGbp ?? null,
          salesCny: feePreview?.salesCny ?? null,
          salesCurrency: feePreview?.salesCurrency ?? null,
          salesAmount: feePreview?.salesAmount ?? null,
        },
      },
      tx,
    );

    return updated;
  };

  const updated = params.tx
    ? await run(params.tx)
    : await prisma.$transaction(async (tx) => run(tx));

  if (!params.tx) {
    await markFeeStatementsNeedsRegeneration({
      workspaceId: workspace.id,
      reasonCode: next
        ? "CANDIDATE_REGISTRATION_FEE_ADDED"
        : "CANDIDATE_REGISTRATION_FEE_REMOVED",
      performedByUserId: params.performedBy.id,
      note: params.reason ?? undefined,
    });
  }

  return updated;
}

export interface CandidateRegistrationFeeValidation {
  missingSchedule: boolean;
  examBoardName?: string;
}

export async function validateCandidateRegistrationFeeForWorkspace(
  workspaceId: string,
): Promise<CandidateRegistrationFeeValidation> {
  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      registrationWindow: { include: { examBoard: { select: { id: true, name: true } } } },
    },
  });

  if (!workspace?.includeCandidateRegistrationFee) {
    return { missingSchedule: false };
  }

  const schedule = await loadCandidateRegistrationFeeSchedule(
    workspace.registrationWindow.examBoardId,
  );

  return {
    missingSchedule: !schedule,
    examBoardName: workspace.registrationWindow.examBoard.name,
  };
}

export function candidateRegistrationFeeWarningMessage(
  validation: CandidateRegistrationFeeValidation,
): string | null {
  if (!validation.missingSchedule) return null;
  return `Missing active Fee Schedule for Candidate Registration Fee (${validation.examBoardName ?? "exam board"}).`;
}
