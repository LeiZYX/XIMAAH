import { calculateFeeAmounts } from "@/lib/fees/calculate";
import {
  previewCandidateRegistrationFee,
} from "@/lib/fees/candidate-registration-fee";
import type { FeeStatementDisplayCurrencyOption } from "@/lib/fees/display-currency";
import { findMatchingFeeRuleWithFallback, resolveEntryTypeForRegistration } from "@/lib/fees/match";
import type { BillingPreviewLine } from "@/components/registrations/BillingPreviewPanel";
import { prisma } from "@/lib/prisma";
import { AUTO_BILLING_SCOPES } from "@/lib/registrations/metadata";

export async function buildWorkspaceBillingPreview(params: {
  workspaceId: string;
  includeCandidateRegistrationFee: boolean;
  savedCandidateRegistrationFee?: boolean;
}): Promise<BillingPreviewLine[]> {
  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: params.workspaceId },
    include: {
      registrationWindow: {
        include: { examBoard: { select: { id: true, name: true, code: true } } },
      },
      registrations: {
        where: {
          status: { in: ["ACTIVE", "LOCKED"] },
          registrationType: { notIn: ["RESTRICTED_INTERNAL", "EXTERNAL"] },
          billingScope: { in: [...AUTO_BILLING_SCOPES] },
        },
        include: {
          subject: { select: { name: true, qualificationId: true } },
          paper: { select: { code: true } },
          examBoard: { select: { name: true } },
        },
      },
    },
  });

  if (!workspace) return [];

  const rules = await prisma.feeRule.findMany({
    where: { registrationWindowId: workspace.registrationWindowId, isActive: true },
  });
  const exchangeRates = await prisma.exchangeRate.findMany({
    where: { registrationWindowId: workspace.registrationWindowId },
    orderBy: { effectiveDate: "desc" },
  });

  const lines: BillingPreviewLine[] = [];

  for (const reg of workspace.registrations) {
    const entryType = resolveEntryTypeForRegistration(reg, workspace);
    const rule = findMatchingFeeRuleWithFallback(rules, {
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
    if (rule) {
      const amounts = calculateFeeAmounts(rule, exchangeRates);
      salesGbp = amounts.salesGbp;
      salesCny = amounts.salesCny;
    }

    lines.push({
      id: reg.id,
      kind: "EXAM_ENTRY",
      serviceName: "Exam Entry",
      boardName: reg.examBoard.name,
      subjectName: reg.subject.name,
      paperCode: reg.paper.code,
      salesGbp,
      salesCny,
      status: "ACTIVE",
    });
  }

  const savedFee = params.savedCandidateRegistrationFee ?? workspace.includeCandidateRegistrationFee;
  if (params.includeCandidateRegistrationFee || savedFee) {
    const preview = await previewCandidateRegistrationFee(
      workspace.registrationWindow.examBoardId,
      workspace.registrationWindowId,
    );

    let status: BillingPreviewLine["status"] = "ACTIVE";
    if (params.includeCandidateRegistrationFee && !savedFee) status = "PENDING_ADD";
    if (!params.includeCandidateRegistrationFee && savedFee) status = "PENDING_REMOVE";

    if (preview && (params.includeCandidateRegistrationFee || status === "PENDING_REMOVE")) {
      lines.push({
        id: "candidate-registration-fee",
        kind: "CANDIDATE_REGISTRATION",
        serviceName: preview.serviceName,
        boardName: workspace.registrationWindow.examBoard.name,
        salesGbp: preview.salesGbp,
        salesCny: preview.salesCny,
        feeScheduleVersion: preview.version,
        status,
      });
    }
  }

  return lines;
}

export async function buildModalBillingPreview(params: {
  registrationWindowId: string;
  examSessionIds: string[];
  includeCandidateRegistrationFee: boolean;
  displayCurrency?: FeeStatementDisplayCurrencyOption;
}): Promise<BillingPreviewLine[]> {
  if (params.examSessionIds.length === 0 && !params.includeCandidateRegistrationFee) {
    return [];
  }

  const window = await prisma.registrationWindow.findUnique({
    where: { id: params.registrationWindowId },
    include: { examBoard: { select: { id: true, name: true, code: true } } },
  });
  if (!window) return [];

  const [rules, exchangeRates, sessions] = await Promise.all([
    prisma.feeRule.findMany({
      where: { registrationWindowId: params.registrationWindowId, isActive: true },
    }),
    prisma.exchangeRate.findMany({
      where: { registrationWindowId: params.registrationWindowId },
      orderBy: { effectiveDate: "desc" },
    }),
    params.examSessionIds.length
      ? prisma.examSession.findMany({
          where: { id: { in: params.examSessionIds } },
          include: {
            paper: {
              include: {
                subject: { include: { qualification: true } },
              },
            },
            examSeries: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const lines: BillingPreviewLine[] = sessions.map((session) => {
    const qualificationId = session.paper.subject.qualificationId;
    const rule = findMatchingFeeRuleWithFallback(rules, {
      examBoardId: window.examBoardId,
      examSeriesId: session.examSeriesId,
      qualificationId,
      subjectId: session.paper.subjectId,
      paperId: session.paper.id,
      examSessionId: session.id,
      entryType: "NORMAL",
    });

    let salesGbp = 0;
    let salesCny = 0;
    if (rule) {
      const amounts = calculateFeeAmounts(rule, exchangeRates);
      salesGbp = amounts.salesGbp;
      salesCny = amounts.salesCny;
    }

    return {
      id: session.id,
      kind: "EXAM_ENTRY",
      serviceName: "Exam Entry",
      boardName: window.examBoard.name,
      subjectName: session.paper.subject.name,
      paperCode: session.paper.code,
      salesGbp,
      salesCny,
      status: "PENDING_ADD",
    };
  });

  if (params.includeCandidateRegistrationFee) {
    const preview = await previewCandidateRegistrationFee(
      window.examBoardId,
      params.registrationWindowId,
    );
    if (preview) {
      lines.push({
        id: "candidate-registration-fee",
        kind: "CANDIDATE_REGISTRATION",
        serviceName: preview.serviceName,
        boardName: window.examBoard.name,
        salesGbp: preview.salesGbp,
        salesCny: preview.salesCny,
        feeScheduleVersion: preview.version,
        status: "PENDING_ADD",
      });
    }
  }

  return lines;
}
