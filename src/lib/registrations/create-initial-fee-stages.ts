import type { FeeEntryType } from "@/generated/prisma/enums";
import type { RegistrationWindowTimingSource } from "@/lib/registrations/sync-fee-stages-from-window";
import { defaultStageWithdrawal } from "@/lib/fees/withdrawal-policy";
import { loadWithdrawalPolicyForBoard } from "@/lib/fees/withdrawal-policy-service";
import { prisma } from "@/lib/prisma";

type InitialFeeStageOptions = {
  lateEntryEnabled: boolean;
  highLateEntryEnabled: boolean;
  examBoardId: string;
};

export async function createInitialFeeStagesForWindow(
  registrationWindowId: string,
  window: RegistrationWindowTimingSource,
  options: InitialFeeStageOptions,
) {
  const policy = await loadWithdrawalPolicyForBoard(options.examBoardId);

  await prisma.registrationWindow.update({
    where: { id: registrationWindowId },
    data: { paymentFeePercent: policy.paymentFeePercent },
  });

  const durationMs =
    window.registrationCloseAt.getTime() - window.studentRegistrationOpenAt.getTime();
  const third = Math.floor(durationMs / 3);

  const templates: Array<{
    stageCode: FeeEntryType;
    stageName: string;
    sequence: number;
    enabled: boolean;
  }> = [{ stageCode: "NORMAL", stageName: "Normal", sequence: 1, enabled: true }];

  if (options.lateEntryEnabled) {
    templates.push({ stageCode: "LATE", stageName: "Late", sequence: 2, enabled: true });
  }

  if (options.highLateEntryEnabled) {
    templates.push({
      stageCode: "HIGH_LATE",
      stageName: "High Late",
      sequence: options.lateEntryEnabled ? 3 : 2,
      enabled: true,
    });
  }

  for (const [index, template] of templates.entries()) {
    const stageStart =
      index === 0
        ? window.studentRegistrationOpenAt
        : new Date(window.studentRegistrationOpenAt.getTime() + third * index);
    const stageEnd =
      index === templates.length - 1
        ? window.registrationCloseAt
        : new Date(window.studentRegistrationOpenAt.getTime() + third * (index + 1) - 1);

    const withdrawal = defaultStageWithdrawal(template.stageCode, policy);

    await prisma.registrationFeeStage.upsert({
      where: {
        registrationWindowId_stageCode: {
          registrationWindowId,
          stageCode: template.stageCode,
        },
      },
      update: {
        stageName: template.stageName,
        sequence: template.sequence,
        startAt: stageStart,
        endAt: stageEnd,
        enabled: template.enabled,
        withdrawalRefundEnabled: withdrawal.withdrawalRefundEnabled,
        withdrawalRefundPercent: withdrawal.withdrawalRefundPercent,
        withdrawalRefundBasis: withdrawal.withdrawalRefundBasis,
        withdrawalNotes: withdrawal.withdrawalNotes,
      },
      create: {
        registrationWindowId,
        stageCode: template.stageCode,
        stageName: template.stageName,
        sequence: template.sequence,
        startAt: stageStart,
        endAt: stageEnd,
        enabled: template.enabled,
        withdrawalRefundEnabled: withdrawal.withdrawalRefundEnabled,
        withdrawalRefundPercent: withdrawal.withdrawalRefundPercent,
        withdrawalRefundBasis: withdrawal.withdrawalRefundBasis,
        withdrawalNotes: withdrawal.withdrawalNotes,
      },
    });
  }
}
