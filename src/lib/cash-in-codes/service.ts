import { prisma } from "@/lib/prisma";
import type { CashInCodeImportColumn } from "@/lib/cash-in-codes/constants";

const listInclude = {
  examBoard: { select: { id: true, name: true, code: true } },
  qualification: { select: { id: true, name: true, level: true, code: true } },
  subject: { select: { id: true, name: true, code: true } },
} as const;

export async function listCashInCodes(input?: {
  examBoardId?: string;
  active?: boolean;
}) {
  return prisma.cashInCode.findMany({
    where: {
      examBoardId: input?.examBoardId || undefined,
      active: input?.active,
    },
    include: listInclude,
    orderBy: [
      { examBoard: { code: "asc" } },
      { qualification: { level: "asc" } },
      { subject: { code: "asc" } },
      { cashInCode: "asc" },
    ],
  });
}

export async function buildCashInCodeExportRows(
  examBoardId?: string,
): Promise<Array<Record<CashInCodeImportColumn, string>>> {
  const rows = await listCashInCodes({ examBoardId });
  return rows.map((row) => ({
    "Exam Board Code": row.examBoard.code,
    "Qualification Level": row.qualification.level,
    "Qualification Code": row.qualification.code ?? "",
    "Subject Code": row.subject.code,
    "Subject Name": row.subject.name,
    "Cash-in Code": row.cashInCode,
    Active: row.active ? "Y" : "N",
    Notes: row.notes ?? "",
  }));
}

export async function createCashInCode(input: {
  examBoardId: string;
  subjectId: string;
  cashInCode: string;
  /** Optional; when omitted, derived from subject.qualificationId */
  qualificationId?: string;
  active?: boolean;
  notes?: string | null;
}) {
  const subject = await prisma.subject.findUnique({
    where: { id: input.subjectId },
    select: { id: true, qualificationId: true, qualification: { select: { examBoardId: true } } },
  });
  if (!subject) throw new Error("Subject not found");
  if (subject.qualification.examBoardId !== input.examBoardId) {
    throw new Error("Subject does not belong to the selected exam board");
  }

  const qualificationId = subject.qualificationId;
  if (input.qualificationId && input.qualificationId !== qualificationId) {
    throw new Error("Subject does not belong to the selected qualification");
  }

  const code = input.cashInCode.trim().toUpperCase();
  if (!code) throw new Error("Cash-in code is required");

  return prisma.cashInCode.create({
    data: {
      examBoardId: input.examBoardId,
      qualificationId,
      subjectId: input.subjectId,
      cashInCode: code,
      active: input.active ?? true,
      notes: input.notes?.trim() || null,
    },
    include: listInclude,
  });
}

export async function updateCashInCode(
  id: string,
  input: {
    cashInCode?: string;
    active?: boolean;
    notes?: string | null;
  },
) {
  const data: {
    cashInCode?: string;
    active?: boolean;
    notes?: string | null;
  } = {};

  if (input.cashInCode !== undefined) {
    const code = input.cashInCode.trim().toUpperCase();
    if (!code) throw new Error("Cash-in code is required");
    data.cashInCode = code;
  }
  if (input.active !== undefined) data.active = input.active;
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

  return prisma.cashInCode.update({
    where: { id },
    data,
    include: listInclude,
  });
}

export async function deleteCashInCode(id: string) {
  return prisma.cashInCode.delete({ where: { id } });
}

export async function listQualificationsForBoard(examBoardId: string) {
  return prisma.qualification.findMany({
    where: { examBoardId },
    select: {
      id: true,
      name: true,
      level: true,
      code: true,
      subjects: {
        select: { id: true, name: true, code: true },
        orderBy: { code: "asc" },
      },
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });
}

/** Flat subject list for subject-first cash-in code UX (qualification derived server-side). */
export async function listSubjectsForBoard(examBoardId: string) {
  const rows = await prisma.subject.findMany({
    where: { qualification: { examBoardId } },
    select: {
      id: true,
      name: true,
      code: true,
      qualificationId: true,
      qualification: { select: { level: true, code: true } },
    },
    orderBy: [{ qualification: { level: "asc" } }, { code: "asc" }, { name: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    qualificationId: row.qualificationId,
    level: row.qualification.level,
    qualificationCode: row.qualification.code,
  }));
}
