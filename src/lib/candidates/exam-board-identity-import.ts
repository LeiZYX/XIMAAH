import * as XLSX from "xlsx";
import type { CandidateExamIdentityStatus } from "@/generated/prisma/enums";
import {
  normalizeExamBoardKey,
  validateExamBoardIdentityInput,
  type ExamBoardIdentityInput,
} from "@/lib/candidates/exam-board-identity.shared";
import { upsertCandidateExamIdentity } from "@/lib/candidates/exam-board-identity";
import {
  generateAssessmentHubCandidateNumber,
} from "@/lib/candidates/service";
import { generateStudentId } from "@/lib/candidates/student-id";
import { prisma } from "@/lib/prisma";

export interface ExamBoardIdentityImportRow {
  rowNumber: number;
  schoolStudentNumber?: string;
  systemStudentId?: string;
  examBoard: string;
  centreNumber?: string;
  candidateNumber?: string;
  uciNumber?: string;
  status?: CandidateExamIdentityStatus;
  statusText?: string;
  notes?: string;
}

export interface ExamBoardIdentityImportError {
  row: number;
  message: string;
  kind: "validation" | "duplicate" | "header";
}

export interface ExamBoardIdentityImportPreviewItem {
  row: number;
  studentAction: "create" | "update";
  action: "create" | "update";
  matchBy?: string;
  schoolStudentNumber: string;
  systemStudentId: string;
  englishName: string;
  chineseName: string;
  examBoard: string;
  centreNumber: string;
  candidateNumber: string;
  uciNumber: string;
  status: string;
  notes: string;
}

export interface ExamBoardIdentityImportSummary {
  studentsCreated: number;
  studentsUpdated: number;
  identitiesCreated: number;
  identitiesUpdated: number;
  schoolNumbersUpdated: number;
}

const HEADER_ALIASES: Record<string, keyof Omit<ExamBoardIdentityImportRow, "rowNumber">> = {
  "school student number": "schoolStudentNumber",
  schoolstudentnumber: "schoolStudentNumber",
  "student number": "schoolStudentNumber",
  studentnumber: "schoolStudentNumber",
  "student id": "systemStudentId",
  studentid: "systemStudentId",
  "exam board": "examBoard",
  examboard: "examBoard",
  "centre number": "centreNumber",
  centrenumber: "centreNumber",
  "center number": "centreNumber",
  "candidate number": "candidateNumber",
  candidatenumber: "candidateNumber",
  "uci number": "uciNumber",
  uci: "uciNumber",
  status: "status",
  notes: "notes",
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function readSheetHeaders(sheet: XLSX.WorkSheet): string[] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const headers: string[] = [];
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
    const value = cellText(cell?.v);
    if (value) headers.push(value);
  }
  return headers;
}

function parseStatusInput(value: unknown): CandidateExamIdentityStatus | undefined {
  const text = cellText(value).toUpperCase();
  if (!text) return undefined;
  switch (text) {
    case "PENDING":
    case "P":
      return "PENDING";
    case "REGISTERED":
    case "R":
      return "REGISTERED";
    case "WITHDRAWN":
    case "W":
      return "WITHDRAWN";
    case "ARCHIVED":
    case "A":
      return "ARCHIVED";
    default:
      return undefined;
  }
}

function mapRow(
  raw: Record<string, unknown>,
  rowNumber: number,
): Partial<ExamBoardIdentityImportRow> & { rowNumber: number } {
  const mapped: Record<string, unknown> = { rowNumber };

  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_ALIASES[normalizeHeader(key)];
    if (field) mapped[field] = value;
  }

  return {
    rowNumber,
    schoolStudentNumber: cellText(mapped.schoolStudentNumber) || undefined,
    systemStudentId: cellText(mapped.systemStudentId) || undefined,
    examBoard: cellText(mapped.examBoard),
    centreNumber: cellText(mapped.centreNumber) || undefined,
    candidateNumber: cellText(mapped.candidateNumber) || undefined,
    uciNumber: cellText(mapped.uciNumber) || undefined,
    statusText: cellText(mapped.status) || undefined,
    status: parseStatusInput(mapped.status),
    notes: cellText(mapped.notes) || undefined,
  };
}

function isBlankRow(raw: Record<string, unknown>): boolean {
  return Object.values(raw).every((value) => cellText(value) === "");
}

function readImportSheet(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((name) => normalizeHeader(name) === "board identities") ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return { sheet, sheetName };
}

export function parseExamBoardIdentityImportWorkbook(
  buffer: ArrayBuffer,
): Array<Partial<ExamBoardIdentityImportRow> & { rowNumber: number }> {
  const { sheet } = readImportSheet(buffer);
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rawRows
    .map((row, index) => mapRow(row, index + 2))
    .filter((row, index) => !isBlankRow(rawRows[index]));
}

export function isCompleteExamBoardIdentityImportRow(
  row: Partial<ExamBoardIdentityImportRow> & { rowNumber: number },
): row is ExamBoardIdentityImportRow {
  return Boolean(
    row.examBoard?.trim() && (row.schoolStudentNumber?.trim() || row.systemStudentId?.trim()),
  );
}

type ExamBoardRecord = { id: string; code: string; name: string };

function resolveExamBoard(boards: ExamBoardRecord[], input: string): ExamBoardRecord | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  const byCode = boards.find((board) => board.code.toUpperCase() === upper);
  if (byCode) return byCode;

  const byName = boards.find((board) => board.name.toUpperCase() === upper);
  if (byName) return byName;

  const key = normalizeExamBoardKey(trimmed, trimmed);
  return (
    boards.find(
      (board) =>
        normalizeExamBoardKey(board.code, board.name) === key ||
        board.name.toUpperCase().includes(upper) ||
        upper.includes(board.code.toUpperCase()),
    ) ?? null
  );
}

async function findCandidateByImportKeys(keys: {
  schoolStudentNumber?: string;
  systemStudentId?: string;
}): Promise<{ candidate: Awaited<ReturnType<typeof prisma.candidate.findFirst>>; matchBy?: string; error?: string }> {
  if (keys.schoolStudentNumber?.trim()) {
    const matches = await prisma.candidate.findMany({
      where: { studentNumber: keys.schoolStudentNumber.trim() },
      take: 2,
    });
    if (matches.length > 1) {
      return { candidate: null, error: "Multiple candidates share this School Student Number" };
    }
    if (matches.length === 1) {
      return { candidate: matches[0], matchBy: "schoolStudentNumber" };
    }
  }

  if (keys.systemStudentId?.trim()) {
    const candidate = await prisma.candidate.findUnique({
      where: { studentId: keys.systemStudentId.trim() },
    });
    if (candidate) {
      return { candidate, matchBy: "studentId" };
    }
  }

  return { candidate: null };
}

type ResolvedCandidate = NonNullable<Awaited<ReturnType<typeof prisma.candidate.findFirst>>>;

type BatchContext = {
  pendingSchoolNumbers: Set<string>;
  createdBySchoolNumber: Map<string, ResolvedCandidate>;
};

type CandidateResolution =
  | { candidate: ResolvedCandidate; studentAction: "update"; matchBy?: string; error?: undefined }
  | { studentAction: "create" | "update"; matchBy?: string; candidate?: undefined; error?: undefined }
  | { candidate?: null; studentAction?: undefined; matchBy?: undefined; error: string };

async function resolveCandidateForImportRow(
  row: ExamBoardIdentityImportRow,
  batch: BatchContext,
): Promise<CandidateResolution> {
  const { candidate, matchBy, error } = await findCandidateByImportKeys({
    schoolStudentNumber: row.schoolStudentNumber,
    systemStudentId: row.systemStudentId,
  });

  if (error) {
    return { error };
  }

  if (candidate) {
    return { candidate, studentAction: "update", matchBy };
  }

  const schoolStudentNumber = row.schoolStudentNumber?.trim();
  if (schoolStudentNumber && batch.createdBySchoolNumber.has(schoolStudentNumber)) {
    return {
      candidate: batch.createdBySchoolNumber.get(schoolStudentNumber)!,
      studentAction: "update",
      matchBy: "schoolStudentNumber",
    };
  }

  if (schoolStudentNumber && batch.pendingSchoolNumbers.has(schoolStudentNumber)) {
    return { studentAction: "update", matchBy: "schoolStudentNumber" };
  }

  if (row.systemStudentId?.trim()) {
    return { error: "Student ID not found" };
  }

  if (!schoolStudentNumber) {
    return { error: "School Student Number is required to create a new student" };
  }

  batch.pendingSchoolNumbers.add(schoolStudentNumber);
  return { studentAction: "create" };
}

async function createInternalCandidateFromImportRow(row: ExamBoardIdentityImportRow) {
  const schoolStudentNumber = row.schoolStudentNumber?.trim() || null;
  const studentId = await generateStudentId();
  const displayName = schoolStudentNumber ?? studentId;

  return prisma.candidate.create({
    data: {
      studentId,
      assessmentHubCandidateNumber: generateAssessmentHubCandidateNumber(),
      candidateType: "INTERNAL",
      englishName: displayName,
      legalEnglishName: displayName,
      studentNumber: schoolStudentNumber,
      status: "ACTIVE",
      loginEnabled: false,
      sourceSystem: "BOARD_REGISTRATION_IMPORT",
    },
  });
}

async function maybeUpdateSchoolStudentNumber(
  candidate: ResolvedCandidate,
  row: ExamBoardIdentityImportRow,
): Promise<boolean> {
  const nextSchoolNumber = row.schoolStudentNumber?.trim();
  if (!nextSchoolNumber || nextSchoolNumber === candidate.studentNumber) {
    return false;
  }

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: { studentNumber: nextSchoolNumber },
  });
  return true;
}

async function loadExamBoards(): Promise<ExamBoardRecord[]> {
  return prisma.examBoard.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function validateExamBoardIdentityImportRows(
  rows: Array<Partial<ExamBoardIdentityImportRow> & { rowNumber: number }>,
  boards: ExamBoardRecord[],
): ExamBoardIdentityImportError[] {
  const errors: ExamBoardIdentityImportError[] = [];
  const seenKeys = new Set<string>();

  for (const row of rows) {
    const rowNum = row.rowNumber;

    if (!row.schoolStudentNumber?.trim() && !row.systemStudentId?.trim()) {
      errors.push({
        row: rowNum,
        message: "School Student Number or Student ID is required",
        kind: "validation",
      });
    }
    if (!row.examBoard?.trim()) {
      errors.push({ row: rowNum, message: "Exam Board is required", kind: "validation" });
    }

    const board = row.examBoard ? resolveExamBoard(boards, row.examBoard) : null;
    if (row.examBoard?.trim() && !board) {
      errors.push({ row: rowNum, message: `Unknown exam board: ${row.examBoard}`, kind: "validation" });
    }

    if (row.statusText && !row.status) {
      errors.push({
        row: rowNum,
        message: "Status must be PENDING, REGISTERED, WITHDRAWN, or ARCHIVED",
        kind: "validation",
      });
    }

    if (board) {
      const input: ExamBoardIdentityInput = {
        centreNumber: row.centreNumber ?? null,
        candidateNumber: row.candidateNumber ?? null,
        uciNumber: row.uciNumber ?? null,
        status: row.status ?? "PENDING",
        notes: row.notes ?? null,
      };
      const validationErrors = validateExamBoardIdentityInput(board.code, input, board.name);
      for (const message of validationErrors) {
        errors.push({ row: rowNum, message, kind: "validation" });
      }
    }

    const dedupeKey = `${row.schoolStudentNumber?.trim() ?? ""}|${row.systemStudentId?.trim() ?? ""}|${row.examBoard?.trim().toUpperCase() ?? ""}`;
    if (dedupeKey !== "||" && seenKeys.has(dedupeKey)) {
      errors.push({
        row: rowNum,
        message: "Duplicate row for the same candidate and exam board",
        kind: "duplicate",
      });
    }
    seenKeys.add(dedupeKey);
  }

  return errors;
}

export async function collectExamBoardIdentityImportErrors(
  buffer: ArrayBuffer,
  rows: Array<Partial<ExamBoardIdentityImportRow> & { rowNumber: number }>,
): Promise<ExamBoardIdentityImportError[]> {
  const boards = await loadExamBoards();
  const syncErrors = validateExamBoardIdentityImportRows(rows, boards);
  const lookupErrors: ExamBoardIdentityImportError[] = [];
  const batch: BatchContext = {
    pendingSchoolNumbers: new Set(),
    createdBySchoolNumber: new Map(),
  };

  for (const row of rows.filter(isCompleteExamBoardIdentityImportRow)) {
    const resolution = await resolveCandidateForImportRow(row, batch);
    if ("error" in resolution && resolution.error) {
      lookupErrors.push({ row: row.rowNumber, message: resolution.error, kind: "validation" });
    }
  }

  return [...validateExamBoardIdentityImportHeaders(buffer), ...syncErrors, ...lookupErrors];
}

export async function previewExamBoardIdentityImportRows(
  rows: ExamBoardIdentityImportRow[],
): Promise<ExamBoardIdentityImportPreviewItem[]> {
  const boards = await loadExamBoards();
  const preview: ExamBoardIdentityImportPreviewItem[] = [];
  const batch: BatchContext = {
    pendingSchoolNumbers: new Set(),
    createdBySchoolNumber: new Map(),
  };

  for (const row of rows) {
    const board = resolveExamBoard(boards, row.examBoard);
    if (!board) continue;

    const resolution = await resolveCandidateForImportRow(row, batch);
    if ("error" in resolution && resolution.error) continue;
    if (!resolution.studentAction) continue;

    let candidate: ResolvedCandidate | null = null;
    if (resolution.studentAction === "update" && "candidate" in resolution && resolution.candidate) {
      candidate = resolution.candidate;
    }
    let systemStudentId = row.systemStudentId?.trim() ?? "";
    let englishName = row.schoolStudentNumber?.trim() ?? "";
    let chineseName = "";
    const schoolStudentNumber = row.schoolStudentNumber?.trim() ?? "";

    if (resolution.studentAction === "create") {
      systemStudentId = "(auto-generated)";
      englishName = schoolStudentNumber || "New student";
    } else if (candidate) {
      systemStudentId = candidate.studentId;
      englishName = candidate.englishName;
      chineseName = candidate.chineseName ?? "";
    } else {
      systemStudentId = "(auto-generated)";
      englishName = schoolStudentNumber || "New student";
    }

    const existing = candidate
      ? await prisma.candidateExamIdentity.findUnique({
          where: { candidateId_examBoardId: { candidateId: candidate.id, examBoardId: board.id } },
          select: { id: true },
        })
      : null;

    preview.push({
      row: row.rowNumber,
      studentAction: resolution.studentAction,
      action: existing ? "update" : "create",
      matchBy: resolution.matchBy,
      schoolStudentNumber: candidate?.studentNumber ?? schoolStudentNumber,
      systemStudentId,
      englishName,
      chineseName,
      examBoard: board.name,
      centreNumber: row.centreNumber ?? "",
      candidateNumber: row.candidateNumber ?? "",
      uciNumber: row.uciNumber ?? "",
      status: row.status ?? "PENDING",
      notes: row.notes ?? "",
    });
  }

  return preview;
}

export async function commitExamBoardIdentityImportRows(
  rows: ExamBoardIdentityImportRow[],
  performedByUserId: string,
): Promise<ExamBoardIdentityImportSummary> {
  const boards = await loadExamBoards();
  const batch: BatchContext = {
    pendingSchoolNumbers: new Set(),
    createdBySchoolNumber: new Map(),
  };
  const updatedStudentIds = new Set<string>();
  const summary: ExamBoardIdentityImportSummary = {
    studentsCreated: 0,
    studentsUpdated: 0,
    identitiesCreated: 0,
    identitiesUpdated: 0,
    schoolNumbersUpdated: 0,
  };

  for (const row of rows) {
    const board = resolveExamBoard(boards, row.examBoard);
    if (!board) continue;

    const resolution = await resolveCandidateForImportRow(row, batch);
    if ("error" in resolution && resolution.error) continue;

    let candidate: ResolvedCandidate;
    if (resolution.studentAction === "create") {
      candidate = await createInternalCandidateFromImportRow(row);
      if (row.schoolStudentNumber?.trim()) {
        batch.createdBySchoolNumber.set(row.schoolStudentNumber.trim(), candidate);
      }
      summary.studentsCreated += 1;
    } else {
      if (!("candidate" in resolution) || !resolution.candidate) {
        const schoolStudentNumber = row.schoolStudentNumber?.trim();
        const batched = schoolStudentNumber
          ? batch.createdBySchoolNumber.get(schoolStudentNumber)
          : undefined;
        if (!batched) continue;
        candidate = batched;
      } else {
        candidate = resolution.candidate;
      }
      updatedStudentIds.add(candidate.id);
      if (await maybeUpdateSchoolStudentNumber(candidate, row)) {
        summary.schoolNumbersUpdated += 1;
      }
    }

    const existing = await prisma.candidateExamIdentity.findUnique({
      where: { candidateId_examBoardId: { candidateId: candidate.id, examBoardId: board.id } },
      select: { id: true },
    });

    await upsertCandidateExamIdentity(
      candidate.id,
      board.id,
      {
        centreNumber: row.centreNumber ?? null,
        candidateNumber: row.candidateNumber ?? null,
        uciNumber: row.uciNumber ?? null,
        status: row.status ?? "PENDING",
        notes: row.notes ?? null,
      },
      performedByUserId,
    );

    if (existing) summary.identitiesUpdated += 1;
    else summary.identitiesCreated += 1;
  }

  summary.studentsUpdated = updatedStudentIds.size;
  return summary;
}

export function validateExamBoardIdentityImportHeaders(buffer: ArrayBuffer): ExamBoardIdentityImportError[] {
  const { sheet } = readImportSheet(buffer);
  const headers = readSheetHeaders(sheet).map(normalizeHeader);
  const errors: ExamBoardIdentityImportError[] = [];

  const hasSchoolNumber = headers.includes("school student number") || headers.includes("student number");
  const hasStudentId = headers.includes("student id");
  if (!hasSchoolNumber && !hasStudentId) {
    errors.push({
      row: 1,
      message: "Import must include School Student Number and/or Student ID column",
      kind: "header",
    });
  }
  if (!headers.includes("exam board")) {
    errors.push({ row: 1, message: 'Import must include an "Exam Board" column', kind: "header" });
  }

  return errors;
}

export function partitionExamBoardIdentityImportErrors(errors: ExamBoardIdentityImportError[]) {
  const duplicates = errors.filter((error) => error.kind === "duplicate");
  const validationErrors = errors.filter((error) => error.kind !== "duplicate");
  const blockingErrorCount = errors.length;
  const canCommit = blockingErrorCount === 0;

  return { duplicates, validationErrors, blockingErrorCount, canCommit };
}
