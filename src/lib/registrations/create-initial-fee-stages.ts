import type { FeeEntryType } from "@/generated/prisma/enums";
import type { RegistrationWindowTimingSource } from "@/lib/registrations/sync-fee-stages-from-window";
import { prisma } from "@/lib/prisma";

type InitialFeeStageOptions = {
  lateEntryEnabled: boolean;
  highLateEntryEnabled: boolean;
};

export async function createInitialFeeStagesForWindow(
  registrationWindowId: string,
  window: RegistrationWindowTimingSource,
  options: InitialFeeStageOptions,
) {
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
      },
      create: {
        registrationWindowId,
        stageCode: template.stageCode,
        stageName: template.stageName,
        sequence: template.sequence,
        startAt: stageStart,
        endAt: stageEnd,
        enabled: template.enabled,
      },
    });
  }
}
