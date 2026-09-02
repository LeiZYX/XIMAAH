import { prisma } from "@/lib/prisma";
import type { CashInCodeImportRow } from "@/lib/cash-in-codes/import-parse";

export interface CashInCodeImportResolvedRow {
  rowNumber: number;
  action: "create" | "update";
  examBoardId: string;
  examBoardCode: string;
  qualificationId: string;
  qualificationLabel: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  cashInCode: string;
  active: boolean;
  notes: string | null;
  existingId?: string;
}

export interface CashInCodeImportValidationError {
  rowNumber: number;
  message: string;
}

function qualificationMatches(
  qualification: { code: string | null; level: string },
  row: CashInCodeImportRow,
): boolean {
  const code = row.qualificationCode.trim().toUpperCase();
  const level = row.qualificationLevel.trim().toUpperCase();
  if (code) {
    return (qualification.code ?? "").trim().toUpperCase() === code;
  }
  return qualification.level.trim().toUpperCase() === level;
}

export async function resolveCashInCodeImportRows(rows: CashInCodeImportRow[]): Promise<{
  resolved: CashInCodeImportResolvedRow[];
  errors: CashInCodeImportValidationError[];
}> {
  const boardCodes = [...new Set(rows.map((row) => row.examBoardCode))];
  const boards = await prisma.examBoard.findMany({
    where: { code: { in: boardCodes } },
    select: {
      id: true,
      code: true,
      qualifications: {
        select: {
          id: true,
          name: true,
          level: true,
          code: true,
          subjects: { select: { id: true, code: true, name: true } },
        },
      },
      cashInCodes: {
        select: {
          id: true,
          qualificationId: true,
          subjectId: true,
          cashInCode: true,
        },
      },
    },
  });
  const boardByCode = new Map(boards.map((board) => [board.code.toUpperCase(), board]));

  const resolved: CashInCodeImportResolvedRow[] = [];
  const errors: CashInCodeImportValidationError[] = [];
  const pendingCodeOwners = new Map<string, { rowNumber: number; subjectKey: string }>();
  const pendingSubjectOwners = new Map<string, number>();

  for (const row of rows) {
    const board = boardByCode.get(row.examBoardCode);
    if (!board) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Exam board "${row.examBoardCode}" not found`,
      });
      continue;
    }

    const matchedQualifications = board.qualifications.filter((qualification) =>
      qualificationMatches(qualification, row),
    );
    if (matchedQualifications.length === 0) {
      errors.push({
        rowNumber: row.rowNumber,
        message: row.qualificationCode
          ? `Qualification code "${row.qualificationCode}" not found for ${row.examBoardCode}`
          : `Qualification level "${row.qualificationLevel}" not found for ${row.examBoardCode}`,
      });
      continue;
    }
    if (matchedQualifications.length > 1 && !row.qualificationCode) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Multiple qualifications match level "${row.qualificationLevel}". Provide Qualification Code.`,
      });
      continue;
    }

    const qualification = matchedQualifications[0]!;
    const subject = qualification.subjects.find(
      (item) => item.code.trim().toUpperCase() === row.subjectCode.toUpperCase(),
    );
    if (!subject) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Subject code "${row.subjectCode}" not found under ${qualification.level}${
          qualification.code ? ` (${qualification.code})` : ""
        }`,
      });
      continue;
    }

    const subjectKey = `${board.id}::${qualification.id}::${subject.id}`;
    const codeKey = `${board.id}::${row.cashInCode.toUpperCase()}`;

    const existingBySubject = board.cashInCodes.find(
      (item) =>
        item.qualificationId === qualification.id && item.subjectId === subject.id,
    );
    const existingByCode = board.cashInCodes.find(
      (item) => item.cashInCode.toUpperCase() === row.cashInCode.toUpperCase(),
    );

    if (
      existingByCode &&
      (!existingBySubject || existingByCode.id !== existingBySubject.id)
    ) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Cash-in code "${row.cashInCode}" is already used by another subject on ${row.examBoardCode}`,
      });
      continue;
    }

    const priorSubjectRow = pendingSubjectOwners.get(subjectKey);
    if (priorSubjectRow != null) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Duplicate subject in import file (also on row ${priorSubjectRow})`,
      });
      continue;
    }

    const priorCodeOwner = pendingCodeOwners.get(codeKey);
    if (priorCodeOwner && priorCodeOwner.subjectKey !== subjectKey) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Duplicate cash-in code "${row.cashInCode}" in import file (also on row ${priorCodeOwner.rowNumber})`,
      });
      continue;
    }

    pendingSubjectOwners.set(subjectKey, row.rowNumber);
    pendingCodeOwners.set(codeKey, { rowNumber: row.rowNumber, subjectKey });

    resolved.push({
      rowNumber: row.rowNumber,
      action: existingBySubject ? "update" : "create",
      examBoardId: board.id,
      examBoardCode: board.code,
      qualificationId: qualification.id,
      qualificationLabel: `${qualification.level}${
        qualification.code ? ` · ${qualification.code}` : ""
      }`,
      subjectId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      cashInCode: row.cashInCode,
      active: row.active,
      notes: row.notes,
      existingId: existingBySubject?.id,
    });
  }

  return { resolved, errors };
}

export async function commitCashInCodeImportRows(
  resolved: CashInCodeImportResolvedRow[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of resolved) {
      if (row.existingId) {
        await tx.cashInCode.update({
          where: { id: row.existingId },
          data: {
            cashInCode: row.cashInCode,
            active: row.active,
            notes: row.notes,
          },
        });
        updated += 1;
      } else {
        await tx.cashInCode.create({
          data: {
            examBoardId: row.examBoardId,
            qualificationId: row.qualificationId,
            subjectId: row.subjectId,
            cashInCode: row.cashInCode,
            active: row.active,
            notes: row.notes,
          },
        });
        created += 1;
      }
    }
  });

  return { created, updated };
}
