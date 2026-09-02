import type { PrismaClient } from "@/generated/prisma/client";
import { isQualificationConsistentWithSubject } from "@/lib/qualifications/subject-qualification";

export type QualificationInventoryIssueKind =
  | "FK_MISMATCH"
  | "ORPHAN_QUALIFICATION"
  | "SYLLABUS_STYLE_QUALIFICATION";

export interface QualificationInventoryIssue {
  kind: QualificationInventoryIssueKind;
  entity: string;
  entityId: string;
  examBoardCode?: string;
  message: string;
  details?: Record<string, string | number | null>;
}

export interface QualificationBoardSummary {
  examBoardId: string;
  examBoardCode: string;
  examBoardName: string;
  qualificationCount: number;
  subjectCount: number;
  /** Qualifications with exactly one subject (common per-syllabus import pattern). */
  singleSubjectQualificationCount: number;
  /** subject.code === qualification.code on a 1-subject qualification. */
  syllabusStyleQualificationCount: number;
  orphanQualificationCount: number;
}

export interface QualificationInventoryReport {
  generatedAt: string;
  boardSummaries: QualificationBoardSummary[];
  issues: QualificationInventoryIssue[];
  totals: {
    qualifications: number;
    subjects: number;
    issueCount: number;
    fkMismatchCount: number;
    orphanQualificationCount: number;
    syllabusStyleQualificationCount: number;
  };
}

export interface SyllabusStyleQualificationInput {
  qualificationId: string;
  qualificationCode: string | null;
  subjectCount: number;
  soleSubjectCode: string | null;
}

/** Detect importer-style 1 syllabus = 1 qualification + 1 subject. */
export function isSyllabusStyleQualification(
  input: SyllabusStyleQualificationInput,
): boolean {
  if (input.subjectCount !== 1 || !input.qualificationCode || !input.soleSubjectCode) {
    return false;
  }
  return input.qualificationCode === input.soleSubjectCode;
}

export function summarizeBoardQualifications(input: {
  examBoardId: string;
  examBoardCode: string;
  examBoardName: string;
  qualifications: Array<{
    id: string;
    code: string | null;
    subjectCount: number;
    soleSubjectCode: string | null;
  }>;
  subjectCount: number;
}): QualificationBoardSummary {
  let singleSubjectQualificationCount = 0;
  let syllabusStyleQualificationCount = 0;
  let orphanQualificationCount = 0;

  for (const qualification of input.qualifications) {
    if (qualification.subjectCount === 0) {
      orphanQualificationCount += 1;
      continue;
    }
    if (qualification.subjectCount === 1) {
      singleSubjectQualificationCount += 1;
      if (
        isSyllabusStyleQualification({
          qualificationId: qualification.id,
          qualificationCode: qualification.code,
          subjectCount: qualification.subjectCount,
          soleSubjectCode: qualification.soleSubjectCode,
        })
      ) {
        syllabusStyleQualificationCount += 1;
      }
    }
  }

  return {
    examBoardId: input.examBoardId,
    examBoardCode: input.examBoardCode,
    examBoardName: input.examBoardName,
    qualificationCount: input.qualifications.length,
    subjectCount: input.subjectCount,
    singleSubjectQualificationCount,
    syllabusStyleQualificationCount,
    orphanQualificationCount,
  };
}

function fkMismatchIssue(input: {
  entity: string;
  entityId: string;
  examBoardCode?: string;
  storedQualificationId: string;
  subjectQualificationId: string;
  subjectId: string;
  subjectCode?: string;
}): QualificationInventoryIssue | null {
  if (
    isQualificationConsistentWithSubject({
      storedQualificationId: input.storedQualificationId,
      subjectQualificationId: input.subjectQualificationId,
    })
  ) {
    return null;
  }

  return {
    kind: "FK_MISMATCH",
    entity: input.entity,
    entityId: input.entityId,
    examBoardCode: input.examBoardCode,
    message: `${input.entity} qualificationId does not match subject.qualificationId`,
    details: {
      storedQualificationId: input.storedQualificationId,
      subjectQualificationId: input.subjectQualificationId,
      subjectId: input.subjectId,
      subjectCode: input.subjectCode ?? null,
    },
  };
}

export async function runQualificationInventory(
  client: PrismaClient,
): Promise<QualificationInventoryReport> {
  const issues: QualificationInventoryIssue[] = [];
  const boardSummaries: QualificationBoardSummary[] = [];

  const boards = await client.examBoard.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  for (const board of boards) {
    const [qualifications, subjectCount] = await Promise.all([
      client.qualification.findMany({
        where: { examBoardId: board.id },
        select: {
          id: true,
          code: true,
          level: true,
          name: true,
          subjects: { select: { code: true }, orderBy: { code: "asc" } },
        },
        orderBy: [{ level: "asc" }, { name: "asc" }],
      }),
      client.subject.count({
        where: { qualification: { examBoardId: board.id } },
      }),
    ]);

    const summary = summarizeBoardQualifications({
      examBoardId: board.id,
      examBoardCode: board.code,
      examBoardName: board.name,
      subjectCount,
      qualifications: qualifications.map((row) => ({
        id: row.id,
        code: row.code,
        subjectCount: row.subjects.length,
        soleSubjectCode: row.subjects.length === 1 ? row.subjects[0]!.code : null,
      })),
    });
    boardSummaries.push(summary);

    for (const qualification of qualifications) {
      if (qualification.subjects.length === 0) {
        issues.push({
          kind: "ORPHAN_QUALIFICATION",
          entity: "Qualification",
          entityId: qualification.id,
          examBoardCode: board.code,
          message: "Qualification has no subjects",
          details: {
            level: qualification.level,
            code: qualification.code,
            name: qualification.name,
          },
        });
      }

      if (
        isSyllabusStyleQualification({
          qualificationId: qualification.id,
          qualificationCode: qualification.code,
          subjectCount: qualification.subjects.length,
          soleSubjectCode:
            qualification.subjects.length === 1 ? qualification.subjects[0]!.code : null,
        })
      ) {
        issues.push({
          kind: "SYLLABUS_STYLE_QUALIFICATION",
          entity: "Qualification",
          entityId: qualification.id,
          examBoardCode: board.code,
          message: "Per-syllabus qualification pattern (1 subject, code matches qualification)",
          details: {
            level: qualification.level,
            code: qualification.code,
            subjectCode: qualification.subjects[0]!.code,
            name: qualification.name,
          },
        });
      }
    }
  }

  const [feeRules, feeSchedules, cashInCodes, cashInRequests] = await Promise.all([
    client.feeRule.findMany({
      where: { subjectId: { not: null } },
      select: {
        id: true,
        qualificationId: true,
        subjectId: true,
        subject: { select: { qualificationId: true, code: true } },
        examBoard: { select: { code: true } },
      },
    }),
    client.feeSchedule.findMany({
      where: {
        subjectId: { not: null },
        qualificationId: { not: null },
      },
      select: {
        id: true,
        qualificationId: true,
        subjectId: true,
        serviceType: true,
        subject: { select: { qualificationId: true, code: true } },
        examBoard: { select: { code: true } },
      },
    }),
    client.cashInCode.findMany({
      select: {
        id: true,
        qualificationId: true,
        subjectId: true,
        cashInCode: true,
        subject: { select: { qualificationId: true, code: true } },
        examBoard: { select: { code: true } },
      },
    }),
    client.cashInRequest.findMany({
      select: {
        id: true,
        qualificationId: true,
        subjectId: true,
        cashInCode: true,
        status: true,
        subject: { select: { qualificationId: true, code: true } },
        examBoard: { select: { code: true } },
      },
    }),
  ]);

  for (const row of feeRules) {
    if (!row.subjectId || !row.subject) continue;
    const issue = fkMismatchIssue({
      entity: "FeeRule",
      entityId: row.id,
      examBoardCode: row.examBoard.code,
      storedQualificationId: row.qualificationId,
      subjectQualificationId: row.subject.qualificationId,
      subjectId: row.subjectId,
      subjectCode: row.subject.code,
    });
    if (issue) issues.push(issue);
  }

  for (const row of feeSchedules) {
    if (!row.subjectId || !row.qualificationId || !row.subject) continue;
    const issue = fkMismatchIssue({
      entity: "FeeSchedule",
      entityId: row.id,
      examBoardCode: row.examBoard.code,
      storedQualificationId: row.qualificationId,
      subjectQualificationId: row.subject.qualificationId,
      subjectId: row.subjectId,
      subjectCode: row.subject.code,
    });
    if (issue) {
      issues.push({
        ...issue,
        details: {
          ...issue.details,
          serviceType: row.serviceType,
        },
      });
    }
  }

  for (const row of cashInCodes) {
    const issue = fkMismatchIssue({
      entity: "CashInCode",
      entityId: row.id,
      examBoardCode: row.examBoard.code,
      storedQualificationId: row.qualificationId,
      subjectQualificationId: row.subject.qualificationId,
      subjectId: row.subjectId,
      subjectCode: row.subject.code,
    });
    if (issue) {
      issues.push({
        ...issue,
        details: { ...issue.details, cashInCode: row.cashInCode },
      });
    }
  }

  for (const row of cashInRequests) {
    const issue = fkMismatchIssue({
      entity: "CashInRequest",
      entityId: row.id,
      examBoardCode: row.examBoard.code,
      storedQualificationId: row.qualificationId,
      subjectQualificationId: row.subject.qualificationId,
      subjectId: row.subjectId,
      subjectCode: row.subject.code,
    });
    if (issue) {
      issues.push({
        ...issue,
        details: {
          ...issue.details,
          cashInCode: row.cashInCode,
          status: row.status,
        },
      });
    }
  }

  const fkMismatchCount = issues.filter((item) => item.kind === "FK_MISMATCH").length;
  const orphanQualificationCount = issues.filter(
    (item) => item.kind === "ORPHAN_QUALIFICATION",
  ).length;
  const syllabusStyleQualificationCount = issues.filter(
    (item) => item.kind === "SYLLABUS_STYLE_QUALIFICATION",
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    boardSummaries,
    issues,
    totals: {
      qualifications: boardSummaries.reduce((sum, row) => sum + row.qualificationCount, 0),
      subjects: boardSummaries.reduce((sum, row) => sum + row.subjectCount, 0),
      issueCount: issues.length,
      fkMismatchCount,
      orphanQualificationCount,
      syllabusStyleQualificationCount,
    },
  };
}

export function formatQualificationInventoryReport(report: QualificationInventoryReport): string {
  const lines: string[] = [
    `Qualification inventory — ${report.generatedAt}`,
    "",
    "Board summary:",
  ];

  for (const board of report.boardSummaries) {
    lines.push(
      `  ${board.examBoardCode} (${board.examBoardName}): ` +
        `${board.qualificationCount} qualifications, ${board.subjectCount} subjects, ` +
        `${board.singleSubjectQualificationCount} single-subject quals, ` +
        `${board.syllabusStyleQualificationCount} syllabus-style, ` +
        `${board.orphanQualificationCount} orphan`,
    );
  }

  lines.push(
    "",
    "Totals:",
    `  Qualifications: ${report.totals.qualifications}`,
    `  Subjects: ${report.totals.subjects}`,
    `  Issues: ${report.totals.issueCount} ` +
      `(FK mismatches: ${report.totals.fkMismatchCount}, ` +
      `orphans: ${report.totals.orphanQualificationCount}, ` +
      `syllabus-style: ${report.totals.syllabusStyleQualificationCount})`,
  );

  const fkMismatches = report.issues.filter((item) => item.kind === "FK_MISMATCH");
  if (fkMismatches.length > 0) {
    lines.push("", "FK mismatches (must fix before Phase 4 migration):");
    for (const issue of fkMismatches.slice(0, 50)) {
      lines.push(
        `  [${issue.examBoardCode ?? "?"}] ${issue.entity} ${issue.entityId}: ${issue.message}`,
      );
    }
    if (fkMismatches.length > 50) {
      lines.push(`  … and ${fkMismatches.length - 50} more`);
    }
  }

  if (report.totals.fkMismatchCount === 0) {
    lines.push("", "No FK mismatches detected.");
  }

  return lines.join("\n");
}
