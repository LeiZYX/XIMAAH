import type { PrismaClient } from "@/generated/prisma/client";
import {
  buildLevelNormalizePlan,
  formatLevelNormalizePlan,
  type LevelNormalizePlan,
  type LevelNormalizeQualification,
} from "@/lib/qualifications/normalize-level";
import { runQualificationInventory } from "@/lib/qualifications/inventory";

export interface LevelNormalizeResult {
  plan: LevelNormalizePlan;
  applied: boolean;
  renamed: number;
  movedSubjects: number;
  remappedFeeRules: number;
  remappedFeeSchedules: number;
  remappedCashInCodes: number;
  remappedCashInRequests: number;
  remappedResources: number;
  deletedQualifications: number;
  postInventoryFkMismatches: number | null;
}

async function loadInputs(client: PrismaClient): Promise<LevelNormalizeQualification[]> {
  const rows = await client.qualification.findMany({
    select: {
      id: true,
      examBoardId: true,
      level: true,
      name: true,
      code: true,
      examBoard: { select: { code: true } },
      subjects: { select: { id: true, code: true }, orderBy: { code: "asc" } },
    },
    orderBy: [{ examBoardId: "asc" }, { level: "asc" }, { name: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    examBoardId: row.examBoardId,
    examBoardCode: row.examBoard.code,
    level: row.level,
    name: row.name,
    code: row.code,
    subjectIds: row.subjects.map((subject) => subject.id),
    subjectCodes: row.subjects.map((subject) => subject.code),
  }));
}

export async function planLevelNormalize(client: PrismaClient): Promise<LevelNormalizePlan> {
  return buildLevelNormalizePlan(await loadInputs(client));
}

async function remapFks(
  tx: {
    feeRule: { updateMany: Function };
    feeSchedule: { updateMany: Function };
    cashInCode: { updateMany: Function };
    cashInRequest: { updateMany: Function };
    resource: { updateMany: Function };
  },
  sourceIds: string[],
  targetId: string,
) {
  if (sourceIds.length === 0) {
    return { feeRules: 0, feeSchedules: 0, cashInCodes: 0, cashInRequests: 0, resources: 0 };
  }

  const [feeRules, feeSchedules, cashInCodes, cashInRequests, resources] = await Promise.all([
    tx.feeRule.updateMany({
      where: { qualificationId: { in: sourceIds } },
      data: { qualificationId: targetId },
    }),
    tx.feeSchedule.updateMany({
      where: { qualificationId: { in: sourceIds } },
      data: { qualificationId: targetId },
    }),
    tx.cashInCode.updateMany({
      where: { qualificationId: { in: sourceIds } },
      data: { qualificationId: targetId },
    }),
    tx.cashInRequest.updateMany({
      where: { qualificationId: { in: sourceIds } },
      data: { qualificationId: targetId },
    }),
    tx.resource.updateMany({
      where: { qualificationId: { in: sourceIds } },
      data: { qualificationId: targetId },
    }),
  ]);

  return {
    feeRules: feeRules.count as number,
    feeSchedules: feeSchedules.count as number,
    cashInCodes: cashInCodes.count as number,
    cashInRequests: cashInRequests.count as number,
    resources: resources.count as number,
  };
}

export async function applyLevelNormalize(client: PrismaClient): Promise<LevelNormalizeResult> {
  const inventory = await runQualificationInventory(client);
  if (inventory.totals.fkMismatchCount > 0) {
    throw new Error(
      `Refusing to normalize levels: ${inventory.totals.fkMismatchCount} FK mismatch(es).`,
    );
  }

  const plan = await planLevelNormalize(client);
  if (plan.collisions.length > 0) {
    throw new Error(
      `Refusing to normalize levels: ${plan.collisions.length} subject-code collision(s).`,
    );
  }

  if (plan.actions.length === 0) {
    return {
      plan,
      applied: false,
      renamed: 0,
      movedSubjects: 0,
      remappedFeeRules: 0,
      remappedFeeSchedules: 0,
      remappedCashInCodes: 0,
      remappedCashInRequests: 0,
      remappedResources: 0,
      deletedQualifications: 0,
      postInventoryFkMismatches: inventory.totals.fkMismatchCount,
    };
  }

  let renamed = 0;
  let movedSubjects = 0;
  let remappedFeeRules = 0;
  let remappedFeeSchedules = 0;
  let remappedCashInCodes = 0;
  let remappedCashInRequests = 0;
  let remappedResources = 0;
  let deletedQualifications = 0;

  await client.$transaction(
    async (tx) => {
      for (const action of plan.actions) {
        if (action.kind === "rename") {
          await tx.qualification.update({
            where: { id: action.qualificationId },
            data: {
              level: action.toLevel,
              name: action.toLevel,
            },
          });
          renamed += 1;
          continue;
        }

        if (action.subjectIdsToMove.length > 0) {
          const moved = await tx.subject.updateMany({
            where: { id: { in: action.subjectIdsToMove } },
            data: { qualificationId: action.targetQualificationId },
          });
          movedSubjects += moved.count;
        }

        const remapped = await remapFks(tx, action.sourceQualificationIds, action.targetQualificationId);
        remappedFeeRules += remapped.feeRules;
        remappedFeeSchedules += remapped.feeSchedules;
        remappedCashInCodes += remapped.cashInCodes;
        remappedCashInRequests += remapped.cashInRequests;
        remappedResources += remapped.resources;

        await tx.qualification.update({
          where: { id: action.targetQualificationId },
          data: {
            level: action.targetLevel,
            name: action.targetLevel,
          },
        });

        const stillHaveSubjects = await tx.subject.groupBy({
          by: ["qualificationId"],
          where: { qualificationId: { in: action.sourceQualificationIds } },
          _count: { _all: true },
        });
        const blocked = new Set(stillHaveSubjects.map((row) => row.qualificationId));
        const deletable = action.sourceQualificationIds.filter((id) => !blocked.has(id));
        if (deletable.length > 0) {
          const deleted = await tx.qualification.deleteMany({
            where: { id: { in: deletable } },
          });
          deletedQualifications += deleted.count;
        }
      }
    },
    { timeout: 60_000 },
  );

  const post = await runQualificationInventory(client);
  if (post.totals.fkMismatchCount > 0) {
    throw new Error(
      `Level normalize completed but post-audit found ${post.totals.fkMismatchCount} FK mismatch(es). Restore from backup.`,
    );
  }

  return {
    plan,
    applied: true,
    renamed,
    movedSubjects,
    remappedFeeRules,
    remappedFeeSchedules,
    remappedCashInCodes,
    remappedCashInRequests,
    remappedResources,
    deletedQualifications,
    postInventoryFkMismatches: post.totals.fkMismatchCount,
  };
}

export function formatLevelNormalizeResult(result: LevelNormalizeResult): string {
  return [
    formatLevelNormalizePlan(result.plan),
    "",
    result.applied ? "Applied: yes" : "Applied: no",
    `Renamed: ${result.renamed}`,
    `Moved subjects: ${result.movedSubjects}`,
    `Remapped fee rules: ${result.remappedFeeRules}`,
    `Remapped fee schedules: ${result.remappedFeeSchedules}`,
    `Remapped cash-in codes: ${result.remappedCashInCodes}`,
    `Remapped cash-in requests: ${result.remappedCashInRequests}`,
    `Remapped resources: ${result.remappedResources}`,
    `Deleted qualifications: ${result.deletedQualifications}`,
    `Post-audit FK mismatches: ${result.postInventoryFkMismatches ?? "n/a"}`,
  ].join("\n");
}
