import { levelQualificationName } from "@/lib/qualifications/timetable-import";

export interface MergeQualificationInput {
  id: string;
  examBoardId: string;
  examBoardCode: string;
  level: string;
  name: string;
  code: string | null;
  subjectIds: string[];
  subjectCodes: string[];
}

export interface QualificationMergeMapping {
  examBoardId: string;
  examBoardCode: string;
  level: string;
  targetQualificationId: string;
  /** True when the target row must be created before remapping. */
  createTarget: boolean;
  targetName: string;
  sourceQualificationIds: string[];
  subjectIdsToMove: string[];
}

export interface SubjectCodeCollision {
  examBoardCode: string;
  level: string;
  subjectCode: string;
  subjectIds: string[];
  qualificationIds: string[];
}

export interface QualificationMergePlan {
  mappings: QualificationMergeMapping[];
  collisions: SubjectCodeCollision[];
  /** Qualifications that already are the sole canonical row for their board+level. */
  alreadyCanonical: number;
  totals: {
    boards: number;
    levelsToMerge: number;
    sourcesToRetire: number;
    subjectsToMove: number;
    targetsToCreate: number;
  };
}

function isCanonicalLevelQualification(qualification: MergeQualificationInput): boolean {
  return qualification.code == null;
}

/**
 * Prefer an existing code=null qualification as the merge target for a board+level.
 * Otherwise create a new level-based qualification.
 */
export function pickCanonicalTarget(
  qualifications: MergeQualificationInput[],
): {
  target: MergeQualificationInput | null;
  createTarget: boolean;
  targetName: string;
} {
  if (qualifications.length === 0) {
    return { target: null, createTarget: false, targetName: "" };
  }

  const level = qualifications[0]!.level.trim();
  const canonical = qualifications.filter(isCanonicalLevelQualification);
  if (canonical.length > 0) {
    // Prefer the one that already holds the most subjects.
    const sorted = [...canonical].sort(
      (a, b) => b.subjectIds.length - a.subjectIds.length || a.id.localeCompare(b.id),
    );
    return {
      target: sorted[0]!,
      createTarget: false,
      targetName: levelQualificationName(level),
    };
  }

  return {
    target: null,
    createTarget: true,
    targetName: levelQualificationName(level),
  };
}

export function findSubjectCodeCollisions(
  qualifications: MergeQualificationInput[],
): SubjectCodeCollision[] {
  if (qualifications.length === 0) return [];

  const byCode = new Map<string, { subjectIds: string[]; qualificationIds: string[] }>();
  for (const qualification of qualifications) {
    for (let i = 0; i < qualification.subjectIds.length; i += 1) {
      const subjectId = qualification.subjectIds[i]!;
      const subjectCode = (qualification.subjectCodes[i] ?? "").trim().toUpperCase();
      if (!subjectCode) continue;
      const existing = byCode.get(subjectCode) ?? {
        subjectIds: [],
        qualificationIds: [],
      };
      existing.subjectIds.push(subjectId);
      if (!existing.qualificationIds.includes(qualification.id)) {
        existing.qualificationIds.push(qualification.id);
      }
      byCode.set(subjectCode, existing);
    }
  }

  const boardCode = qualifications[0]!.examBoardCode;
  const level = qualifications[0]!.level;
  const collisions: SubjectCodeCollision[] = [];
  for (const [subjectCode, entry] of byCode) {
    const uniqueSubjects = [...new Set(entry.subjectIds)];
    if (uniqueSubjects.length > 1) {
      collisions.push({
        examBoardCode: boardCode,
        level,
        subjectCode,
        subjectIds: uniqueSubjects,
        qualificationIds: entry.qualificationIds,
      });
    }
  }
  return collisions;
}

/**
 * Build a merge plan: one canonical qualification per examBoardId + level.
 * Subject IDs are never changed; only qualificationId FKs move.
 */
export function buildQualificationMergePlan(
  qualifications: MergeQualificationInput[],
): QualificationMergePlan {
  const byBoardLevel = new Map<string, MergeQualificationInput[]>();
  for (const qualification of qualifications) {
    const key = `${qualification.examBoardId}::${qualification.level.trim()}`;
    const list = byBoardLevel.get(key) ?? [];
    list.push(qualification);
    byBoardLevel.set(key, list);
  }

  const mappings: QualificationMergeMapping[] = [];
  const collisions: SubjectCodeCollision[] = [];
  let alreadyCanonical = 0;
  const boardIds = new Set<string>();

  for (const group of byBoardLevel.values()) {
    boardIds.add(group[0]!.examBoardId);
    collisions.push(...findSubjectCodeCollisions(group));

    const { target, createTarget, targetName } = pickCanonicalTarget(group);
    const sources = target
      ? group.filter((item) => item.id !== target.id)
      : group;

    // Already a single canonical qualification for this level.
    if (!createTarget && target && sources.length === 0) {
      alreadyCanonical += 1;
      continue;
    }

    const subjectIdsToMove = createTarget
      ? group.flatMap((item) => item.subjectIds)
      : sources.flatMap((item) => item.subjectIds);

    const sourceIds = createTarget
      ? group.map((item) => item.id)
      : sources.map((item) => item.id);

    mappings.push({
      examBoardId: group[0]!.examBoardId,
      examBoardCode: group[0]!.examBoardCode,
      level: group[0]!.level.trim(),
      targetQualificationId:
        target?.id ?? `__create__:${group[0]!.examBoardId}:${group[0]!.level.trim()}`,
      createTarget,
      targetName,
      sourceQualificationIds: sourceIds,
      subjectIdsToMove,
    });
  }

  return {
    mappings,
    collisions,
    alreadyCanonical,
    totals: {
      boards: boardIds.size,
      levelsToMerge: mappings.length,
      sourcesToRetire: mappings.reduce((sum, row) => sum + row.sourceQualificationIds.length, 0),
      subjectsToMove: mappings.reduce((sum, row) => sum + row.subjectIdsToMove.length, 0),
      targetsToCreate: mappings.filter((row) => row.createTarget).length,
    },
  };
}

export function formatQualificationMergePlan(plan: QualificationMergePlan): string {
  const lines: string[] = [
    "Qualification merge plan",
    "",
    `Boards: ${plan.totals.boards}`,
    `Levels to merge: ${plan.totals.levelsToMerge}`,
    `Source qualifications to retire: ${plan.totals.sourcesToRetire}`,
    `Subjects to move: ${plan.totals.subjectsToMove}`,
    `Targets to create: ${plan.totals.targetsToCreate}`,
    `Already canonical levels: ${plan.alreadyCanonical}`,
  ];

  if (plan.collisions.length > 0) {
    lines.push("", `BLOCKER: ${plan.collisions.length} subject-code collision(s):`);
    for (const collision of plan.collisions.slice(0, 30)) {
      lines.push(
        `  [${collision.examBoardCode}] ${collision.level} code=${collision.subjectCode} ` +
          `subjects=${collision.subjectIds.join(",")} quals=${collision.qualificationIds.join(",")}`,
      );
    }
    if (plan.collisions.length > 30) {
      lines.push(`  … and ${plan.collisions.length - 30} more`);
    }
  } else {
    lines.push("", "No subject-code collisions.");
  }

  if (plan.mappings.length > 0) {
    lines.push("", "Mappings:");
    for (const mapping of plan.mappings.slice(0, 40)) {
      lines.push(
        `  [${mapping.examBoardCode}] ${mapping.level} → ` +
          `${mapping.createTarget ? "CREATE" : mapping.targetQualificationId} ` +
          `(move ${mapping.subjectIdsToMove.length} subject(s), retire ${mapping.sourceQualificationIds.length})`,
      );
    }
    if (plan.mappings.length > 40) {
      lines.push(`  … and ${plan.mappings.length - 40} more`);
    }
  }

  return lines.join("\n");
}
