import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import { createRegistrationAuditLog } from "@/lib/registrations/audit";
import { RegistrationAuditAction } from "@/generated/prisma/enums";
import { RegistrationError } from "@/lib/registrations/errors";
import { feeStageLabel } from "@/lib/registrations/fee-stages";
import {
  assertFeeStageDatesValid,
  type RegistrationFeeStageRecord,
} from "@/lib/registrations/fee-stages";
import { applyWindowTimingToFeeStages } from "@/lib/registrations/sync-fee-stages-from-window";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const feeStages = await prisma.registrationFeeStage.findMany({
    where: { registrationWindowId: id },
    orderBy: { sequence: "asc" },
  });

  return NextResponse.json(feeStages);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageRegistrationWindows(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = parseJsonBody<{
      feeStages: Array<{
        id?: string;
        stageCode: "NORMAL" | "LATE" | "HIGH_LATE";
        stageName: string;
        sequence: number;
        startAt: string;
        endAt: string;
        enabled: boolean;
        notes?: string | null;
      }>;
    }>(body, ["feeStages"]);

    if (!data?.feeStages) {
      return jsonError("feeStages array is required", 400);
    }

    const window = await prisma.registrationWindow.findUnique({ where: { id } });
    if (!window) return jsonError("Registration window not found", 404);

    if (data.feeStages.length > 0) {
      const boundStages = applyWindowTimingToFeeStages(
        data.feeStages.map((stage) => ({
          ...stage,
          startAt: new Date(stage.startAt),
          endAt: new Date(stage.endAt),
        })),
        window,
      );

      const parsed: RegistrationFeeStageRecord[] = boundStages.map((stage) => ({
        id: stage.id ?? stage.stageCode,
        registrationWindowId: id,
        stageCode: stage.stageCode,
        stageName: stage.stageName.trim(),
        sequence: stage.sequence,
        startAt: stage.startAt instanceof Date ? stage.startAt : new Date(stage.startAt),
        endAt: stage.endAt instanceof Date ? stage.endAt : new Date(stage.endAt),
        enabled: stage.enabled,
        notes: stage.notes ?? null,
      }));

      assertFeeStageDatesValid(parsed, window);
    }

    const existing = await prisma.registrationFeeStage.findMany({
      where: { registrationWindowId: id },
    });

    const results = await prisma.$transaction(async (tx) => {
      if (data.feeStages.length === 0) {
        await tx.registrationFeeStage.deleteMany({ where: { registrationWindowId: id } });
        return [];
      }

      const incomingCodes = new Set(data.feeStages.map((stage) => stage.stageCode));
      await tx.registrationFeeStage.deleteMany({
        where: {
          registrationWindowId: id,
          stageCode: { notIn: [...incomingCodes] },
        },
      });

      const saved = [];
      const boundIncoming = applyWindowTimingToFeeStages(
        data.feeStages.map((stage) => ({
          ...stage,
          startAt: new Date(stage.startAt),
          endAt: new Date(stage.endAt),
        })),
        window,
      );

      for (const stage of boundIncoming) {
        const startAt = stage.startAt instanceof Date ? stage.startAt : new Date(stage.startAt);
        const endAt = stage.endAt instanceof Date ? stage.endAt : new Date(stage.endAt);
        const row = await tx.registrationFeeStage.upsert({
          where: {
            registrationWindowId_stageCode: {
              registrationWindowId: id,
              stageCode: stage.stageCode,
            },
          },
          create: {
            registrationWindowId: id,
            stageCode: stage.stageCode,
            stageName: stage.stageName.trim(),
            sequence: stage.sequence,
            startAt,
            endAt,
            enabled: stage.enabled,
            notes: stage.notes?.trim() || null,
          },
          update: {
            stageName: stage.stageName.trim(),
            sequence: stage.sequence,
            startAt,
            endAt,
            enabled: stage.enabled,
            notes: stage.notes?.trim() || null,
          },
        });
        saved.push(row);

        const prior = existing.find((e) => e.stageCode === stage.stageCode);
        const action = prior
          ? RegistrationAuditAction.FEE_STAGE_UPDATED
          : RegistrationAuditAction.FEE_STAGE_CREATED;

        await createRegistrationAuditLog(
          {
            registrationWindowId: id,
            examSessionId: null,
            action,
            performedById: auth.user.id,
            performedByRole: auth.user.role,
            feeStageId: row.id,
            entryType: row.stageCode,
            reason: `${feeStageLabel(row.stageCode)} fee stage saved`,
            note: row.enabled ? row.stageName : `${row.stageName} (disabled)`,
          },
          tx,
        );
      }

      return saved;
    });

    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
