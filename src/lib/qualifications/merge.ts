import type { PrismaClient } from "@/generated/prisma/client";
import {
  buildQualificationMergePlan,
  formatQualificationMergePlan,
  type MergeQualificationInput,
  type QualificationMergePlan,
} from "@/lib/qualifications/merge-plan";
import { runQualificationInventory } from "@/lib/qualifications/inventory";

export interface QualificationMergeResult {
  plan: QualificationMergePlan;
  applied: boolean;
  createdTargets: number;
  movedSubjects: number;
  remappedFeeRules: number;
  remappedFeeSchedules: number;
  remappedCashInCodes: number;
  remappedCashInRequests: number;
  remappedResources: number;
  deletedQualifications: number;
  postInventoryFkMismatches: number | null;
  postInventorySyllabusStyle: number | null;
}

export async function loadMergeQualificationInputs(
  client: PrismaClient,
): Promise<MergeQualificationInput[]> {
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

export async function planQualificationMerge(
  client: PrismaClient,
): Promise<QualificationMergePlan> {
  const inputs = await loadMergeQualificationInputs(client);
  return buildQualificationMergePlan(inputs);
}

async function remapQualificationFk(
  client: PrismaClient,
  sourceIds: string[],
  targetId: string,
): Promise<{
  feeRules: number;
  feeSchedules: number;
  cashInCodes: number;
  cashInRequests: number;
  resources: number;
}> {
  if (sourceIds.length === 0) {
    return {
      feeRules: 0,
      feeSchedules: 0,
      cashInCodes: 0,
      cashInRequests: 0,
      resources: 0,
    };
  }

  const [feeRules, feeSchedules, cashInCodes, cashInRequests, resources] =
    await Promise.all([
      client.feeRule.updateMany({
        where: { qualificationId: { in: sourceIds } },
        data: { qualificationId: targetId },
      }),
      client.feeSchedule.updateMany({
        where: { qualificationId: { in: sourceIds } },
        data: { qualificationId: targetId },
      }),
      client.cashInCode.updateMany({
        where: { qualificationId: { in: sourceIds } },
        data: { qualificationId: targetId },
      }),
      client.cashInRequest.updateMany({
        where: { qualificationId: { in: sourceIds } },
        data: { qualificationId: targetId },
      }),
      client.resource.updateMany({
        where: { qualificationId: { in: sourceIds } },
        data: { qualificationId: targetId },
      }),
    ]);

  return {
    feeRules: feeRules.count,
    feeSchedules: feeSchedules.count,
    cashInCodes: cashInCodes.count,
    cashInRequests: cashInRequests.count,
    resources: resources.count,
  };
}

/**
 * Apply the merge plan inside a transaction.
 * Requires collisions.length === 0 and inventory fkMismatchCount === 0.
 */
export async function applyQualificationMerge(
  client: PrismaClient,
  options?: { skipPostInventory?: boolean },
): Promise<QualificationMergeResult> {
  const inventory = await runQualificationInventory(client);
  if (inventory.totals.fkMismatchCount > 0) {
    throw new Error(
      `Refusing to merge: ${inventory.totals.fkMismatchCount} FK mismatch(es). Run db:audit-qualifications first.`,
    );
  }

  const plan = await planQualificationMerge(client);
  if (plan.collisions.length > 0) {
    throw new Error(
      `Refusing to merge: ${plan.collisions.length} subject-code collision(s) within the same board+level. Resolve manually first.`,
    );
  }

  if (plan.mappings.length === 0) {
    return {
      plan,
      applied: false,
      createdTargets: 0,
      movedSubjects: 0,
      remappedFeeRules: 0,
      remappedFeeSchedules: 0,
      remappedCashInCodes: 0,
      remappedCashInRequests: 0,
      remappedResources: 0,
      deletedQualifications: 0,
      postInventoryFkMismatches: inventory.totals.fkMismatchCount,
      postInventorySyllabusStyle: inventory.totals.syllabusStyleQualificationCount,
    };
  }

  let createdTargets = 0;
  let movedSubjects = 0;
  let remappedFeeRules = 0;
  let remappedFeeSchedules = 0;
  let remappedCashInCodes = 0;
  let remappedCashInRequests = 0;
  let remappedResources = 0;
  let deletedQualifications = 0;

  await client.$transaction(
    async (tx) => {
      for (const mapping of plan.mappings) {
        let targetId = mapping.targetQualificationId;

        if (mapping.createTarget) {
          const created = await tx.qualification.create({
            data: {
              examBoardId: mapping.examBoardId,
              level: mapping.level,
              name: mapping.targetName,
              code: null,
            },
            select: { id: true },
          });
          targetId = created.id;
          createdTargets += 1;
        }

        const sourceIds = mapping.sourceQualificationIds.filter((id) => id !== targetId);
        if (mapping.subjectIdsToMove.length > 0) {
          const moved = await tx.subject.updateMany({
            where: { id: { in: mapping.subjectIdsToMove } },
            data: { qualificationId: targetId },
          });
          movedSubjects += moved.count;
        }

        const remapped = await remapQualificationFk(tx as unknown as PrismaClient, sourceIds, targetId);
        remappedFeeRules += remapped.feeRules;
        remappedFeeSchedules += remapped.feeSchedules;
        remappedCashInCodes += remapped.cashInCodes;
        remappedCashInRequests += remapped.cashInRequests;
        remappedResources += remapped.resources;

        if (sourceIds.length > 0) {
          // Only delete sources that no longer have subjects.
          const stillHaveSubjects = await tx.subject.groupBy({
            by: ["qualificationId"],
            where: { qualificationId: { in: sourceIds } },
            _count: { _all: true },
          });
          const blocked = new Set(stillHaveSubjects.map((row) => row.qualificationId));
          const deletable = sourceIds.filter((id) => !blocked.has(id));
          if (deletable.length > 0) {
            const deleted = await tx.qualification.deleteMany({
              where: { id: { in: deletable } },
            });
            deletedQualifications += deleted.count;
          }
        }
      }
    },
    { timeout: 120_000 },
  );

  let postInventoryFkMismatches: number | null = null;
  let postInventorySyllabusStyle: number | null = null;
  if (!options?.skipPostInventory) {
    const post = await runQualificationInventory(client);
    postInventoryFkMismatches = post.totals.fkMismatchCount;
    postInventorySyllabusStyle = post.totals.syllabusStyleQualificationCount;
    if (post.totals.fkMismatchCount > 0) {
      throw new Error(
        `Merge completed but post-audit found ${post.totals.fkMismatchCount} FK mismatch(es). Restore from backup and investigate.`,
      );
    }
  }

  return {
    plan,
    applied: true,
    createdTargets,
    movedSubjects,
    remappedFeeRules,
    remappedFeeSchedules,
    remappedCashInCodes,
    remappedCashInRequests,
    remappedResources,
    deletedQualifications,
    postInventoryFkMismatches,
    postInventorySyllabusStyle,
  };
}

export function formatQualificationMergeResult(result: QualificationMergeResult): string {
  const lines = [
    formatQualificationMergePlan(result.plan),
    "",
    result.applied ? "Applied: yes" : "Applied: no (nothing to do or dry-run)",
    `Created targets: ${result.createdTargets}`,
    `Moved subjects: ${result.movedSubjects}`,
    `Remapped fee rules: ${result.remappedFeeRules}`,
    `Remapped fee schedules: ${result.remappedFeeSchedules}`,
    `Remapped cash-in codes: ${result.remappedCashInCodes}`,
    `Remapped cash-in requests: ${result.remappedCashInRequests}`,
    `Remapped resources: ${result.remappedResources}`,
    `Deleted qualifications: ${result.deletedQualifications}`,
  ];

  if (result.postInventoryFkMismatches != null) {
    lines.push(`Post-audit FK mismatches: ${result.postInventoryFkMismatches}`);
  }
  if (result.postInventorySyllabusStyle != null) {
    lines.push(`Post-audit syllabus-style quals: ${result.postInventorySyllabusStyle}`);
  }

  return lines.join("\n");
}
