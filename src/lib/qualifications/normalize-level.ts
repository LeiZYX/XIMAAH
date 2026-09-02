/**
 * Canonicalize qualification level labels so variants like "A-Level" / "A Level"
 * collapse to one string for merge grouping.
 */
export function normalizeQualificationLevel(level: string): string {
  return level
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface LevelNormalizeQualification {
  id: string;
  examBoardId: string;
  examBoardCode: string;
  level: string;
  name: string;
  code: string | null;
  subjectIds: string[];
  subjectCodes: string[];
}

export type LevelNormalizeAction =
  | {
      kind: "rename";
      examBoardCode: string;
      qualificationId: string;
      fromLevel: string;
      toLevel: string;
      subjectCount: number;
    }
  | {
      kind: "merge";
      examBoardCode: string;
      targetQualificationId: string;
      targetLevel: string;
      sourceQualificationIds: string[];
      sourceLevels: string[];
      subjectIdsToMove: string[];
    };

export interface LevelNormalizePlan {
  actions: LevelNormalizeAction[];
  collisions: Array<{
    examBoardCode: string;
    normalizedLevel: string;
    subjectCode: string;
    subjectIds: string[];
  }>;
  totals: {
    renames: number;
    merges: number;
    subjectsToMove: number;
    sourcesToRetire: number;
  };
}

function pickTarget(group: LevelNormalizeQualification[]): LevelNormalizeQualification {
  const canonicalLevel = normalizeQualificationLevel(group[0]!.level);
  const alreadyCanonical = group.filter((item) => item.level === canonicalLevel);
  const pool = alreadyCanonical.length > 0 ? alreadyCanonical : group;
  return [...pool].sort(
    (a, b) =>
      b.subjectIds.length - a.subjectIds.length ||
      (a.code === null ? -1 : 1) - (b.code === null ? -1 : 1) ||
      a.id.localeCompare(b.id),
  )[0]!;
}

export function buildLevelNormalizePlan(
  qualifications: LevelNormalizeQualification[],
): LevelNormalizePlan {
  const byBoardNormalized = new Map<string, LevelNormalizeQualification[]>();
  for (const qualification of qualifications) {
    const key = `${qualification.examBoardId}::${normalizeQualificationLevel(qualification.level)}`;
    const list = byBoardNormalized.get(key) ?? [];
    list.push(qualification);
    byBoardNormalized.set(key, list);
  }

  const actions: LevelNormalizeAction[] = [];
  const collisions: LevelNormalizePlan["collisions"] = [];

  for (const group of byBoardNormalized.values()) {
    const canonicalLevel = normalizeQualificationLevel(group[0]!.level);
    const examBoardCode = group[0]!.examBoardCode;

    // Collision check across the whole group (same board + normalized level).
    const byCode = new Map<string, string[]>();
    for (const qualification of group) {
      for (let i = 0; i < qualification.subjectIds.length; i += 1) {
        const code = (qualification.subjectCodes[i] ?? "").trim().toUpperCase();
        if (!code) continue;
        const list = byCode.get(code) ?? [];
        list.push(qualification.subjectIds[i]!);
        byCode.set(code, list);
      }
    }
    for (const [subjectCode, subjectIds] of byCode) {
      const unique = [...new Set(subjectIds)];
      if (unique.length > 1) {
        collisions.push({
          examBoardCode,
          normalizedLevel: canonicalLevel,
          subjectCode,
          subjectIds: unique,
        });
      }
    }

    if (group.length === 1) {
      const only = group[0]!;
      if (only.level !== canonicalLevel) {
        actions.push({
          kind: "rename",
          examBoardCode,
          qualificationId: only.id,
          fromLevel: only.level,
          toLevel: canonicalLevel,
          subjectCount: only.subjectIds.length,
        });
      }
      continue;
    }

    const target = pickTarget(group);
    const sources = group.filter((item) => item.id !== target.id);
    actions.push({
      kind: "merge",
      examBoardCode,
      targetQualificationId: target.id,
      targetLevel: canonicalLevel,
      sourceQualificationIds: sources.map((item) => item.id),
      sourceLevels: sources.map((item) => item.level),
      subjectIdsToMove: sources.flatMap((item) => item.subjectIds),
    });

    // If target level/name still uses a variant spelling, rename it as part of merge apply.
    if (target.level !== canonicalLevel) {
      actions.push({
        kind: "rename",
        examBoardCode,
        qualificationId: target.id,
        fromLevel: target.level,
        toLevel: canonicalLevel,
        subjectCount: target.subjectIds.length + sources.reduce((n, s) => n + s.subjectIds.length, 0),
      });
    }
  }

  return {
    actions,
    collisions,
    totals: {
      renames: actions.filter((item) => item.kind === "rename").length,
      merges: actions.filter((item) => item.kind === "merge").length,
      subjectsToMove: actions
        .filter((item): item is Extract<LevelNormalizeAction, { kind: "merge" }> => item.kind === "merge")
        .reduce((sum, item) => sum + item.subjectIdsToMove.length, 0),
      sourcesToRetire: actions
        .filter((item): item is Extract<LevelNormalizeAction, { kind: "merge" }> => item.kind === "merge")
        .reduce((sum, item) => sum + item.sourceQualificationIds.length, 0),
    },
  };
}

export function formatLevelNormalizePlan(plan: LevelNormalizePlan): string {
  const lines: string[] = [
    "Qualification level normalize plan",
    "",
    `Renames: ${plan.totals.renames}`,
    `Merges: ${plan.totals.merges}`,
    `Subjects to move: ${plan.totals.subjectsToMove}`,
    `Sources to retire: ${plan.totals.sourcesToRetire}`,
  ];

  if (plan.collisions.length > 0) {
    lines.push("", `BLOCKER: ${plan.collisions.length} subject-code collision(s):`);
    for (const collision of plan.collisions.slice(0, 20)) {
      lines.push(
        `  [${collision.examBoardCode}] ${collision.normalizedLevel} code=${collision.subjectCode}`,
      );
    }
  } else {
    lines.push("", "No subject-code collisions.");
  }

  if (plan.actions.length === 0) {
    lines.push("", "Nothing to do — levels already canonical.");
  } else {
    lines.push("", "Actions:");
    for (const action of plan.actions) {
      if (action.kind === "rename") {
        lines.push(
          `  [${action.examBoardCode}] RENAME ${action.qualificationId}: ` +
            `"${action.fromLevel}" → "${action.toLevel}" (${action.subjectCount} subject(s))`,
        );
      } else {
        lines.push(
          `  [${action.examBoardCode}] MERGE → "${action.targetLevel}" (${action.targetQualificationId}): ` +
            `move ${action.subjectIdsToMove.length} from [${action.sourceLevels.join(", ")}]`,
        );
      }
    }
  }

  return lines.join("\n");
}
