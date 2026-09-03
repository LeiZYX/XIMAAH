/**
 * Import Pearson Edexcel UCI / Candidate Number from an IAL Bulk Entries Excel
 * into CandidateExamIdentity (Candidate Board Registration).
 *
 * Matching: Excel Firstname + Lastname + DOB(dd/mm/yyyy) → Candidate
 * Fixed centre number: 96834
 *
 * Usage (dry-run by default):
 *   npx tsx scripts/import-edexcel-uci-from-bulk-entries.ts "/path/to/IALBulkEntriesTemplate1.xlsx"
 *   npx tsx scripts/import-edexcel-uci-from-bulk-entries.ts "/path/to/file.xlsx" --apply
 *
 * Docker:
 *   docker compose exec app npx tsx scripts/import-edexcel-uci-from-bulk-entries.ts /data/file.xlsx --apply
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";
import { upsertCandidateExamIdentity } from "../src/lib/candidates/exam-board-identity";

const FIXED_CENTRE_NUMBER = "96834";

type ExcelRow = {
  rowNumber: number;
  uciNumber: string;
  candidateNumber: string;
  firstName: string;
  lastName: string;
  dobKey: string;
  dobRaw: string;
};

type CandidateMatch = {
  id: string;
  englishName: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: Date | null;
  studentNumber: string | null;
  assessmentHubCandidateNumber: string;
};

function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function nameKey(firstName: string, lastName: string): string {
  return `${normalizeName(firstName)}|${normalizeName(lastName)}`;
}

function dateKeyFromParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse DOB(dd/mm/yyyy) or Excel date serial / Date. */
function parseDobKey(value: unknown): { key: string; raw: string } | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      key: dateKeyFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()),
      raw: value.toISOString().slice(0, 10),
    };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return {
      key: dateKeyFromParts(parsed.y, parsed.m, parsed.d),
      raw: String(value),
    };
  }

  const text = String(value).trim();
  const dmY = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const day = Number(dmY[1]);
    const month = Number(dmY[2]);
    const year = Number(dmY[3]);
    return { key: dateKeyFromParts(year, month, day), raw: text };
  }

  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    return {
      key: dateKeyFromParts(Number(ymd[1]), Number(ymd[2]), Number(ymd[3])),
      raw: text,
    };
  }

  return null;
}

function dobKeyFromDb(date: Date | null | undefined): string | null {
  if (!date) return null;
  // Candidate DOB is stored as date-only (UTC midnight in practice).
  return dateKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function readExcelRows(filePath: string): ExcelRow[] {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel has no sheets");
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (matrix.length === 0) throw new Error("Excel sheet is empty");

  const header = (matrix[0] ?? []).map((cell) => cellText(cell).toLowerCase());
  const uciIdx = header.findIndex((h) => h === "uci number" || h === "uci");
  const candIdx = header.findIndex((h) => h === "candidate number");
  const firstIdx = header.findIndex((h) => h === "firstname" || h === "first name");
  const lastIdx = header.findIndex((h) => h === "lastname" || h === "last name");
  const dobIdx = header.findIndex((h) => h.startsWith("dob"));

  if (uciIdx < 0 || candIdx < 0 || firstIdx < 0 || lastIdx < 0 || dobIdx < 0) {
    throw new Error(
      `Missing required columns. Need UCI Number, Candidate Number, Firstname, Lastname, DOB. Got: ${header.filter(Boolean).join(", ")}`,
    );
  }

  const rows: ExcelRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? [];
    if (!line.some((cell) => cell != null && String(cell).trim() !== "")) continue;

    const firstName = cellText(line[firstIdx]);
    const lastName = cellText(line[lastIdx]);
    const uciNumber = cellText(line[uciIdx]);
    const candidateNumber = cellText(line[candIdx]);
    const dob = parseDobKey(line[dobIdx]);

    if (!firstName && !lastName && !uciNumber) continue;

    if (!firstName || !lastName || !uciNumber || !candidateNumber || !dob) {
      console.warn(
        `Row ${i + 1}: skip incomplete row (name/dob/uci/candidate number required)`,
      );
      continue;
    }

    rows.push({
      rowNumber: i + 1,
      uciNumber,
      candidateNumber,
      firstName,
      lastName,
      dobKey: dob.key,
      dobRaw: dob.raw,
    });
  }

  return rows;
}

function candidateMatchesExcel(candidate: CandidateMatch, row: ExcelRow): boolean {
  const dob = dobKeyFromDb(candidate.dateOfBirth);
  if (dob !== row.dobKey) return false;

  const excelKey = nameKey(row.firstName, row.lastName);
  if (candidate.firstName && candidate.lastName) {
    if (nameKey(candidate.firstName, candidate.lastName) === excelKey) return true;
  }

  const english = normalizeName(candidate.englishName);
  const first = normalizeName(row.firstName);
  const last = normalizeName(row.lastName);
  if (english === `${first} ${last}` || english === `${last} ${first}`) return true;
  if (english.includes(first) && english.includes(last)) return true;

  return false;
}

async function resolveEdexcelBoard() {
  const boards = await prisma.examBoard.findMany({
    select: { id: true, code: true, name: true },
  });
  const board =
    boards.find((item) => item.code.toUpperCase() === "EDEXCEL") ??
    boards.find((item) => /edexcel|pearson/i.test(`${item.code} ${item.name}`));
  if (!board) {
    throw new Error("Pearson Edexcel exam board not found in database");
  }
  return board;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileArg = args.find((arg) => !arg.startsWith("--"));

  if (!fileArg) {
    console.error(
      "Usage: npx tsx scripts/import-edexcel-uci-from-bulk-entries.ts <xlsx-path> [--apply]",
    );
    process.exit(1);
  }

  const filePath = path.resolve(fileArg);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const excelRows = readExcelRows(filePath);
  console.log(`Read ${excelRows.length} Excel row(s) from ${filePath}`);
  console.log(apply ? "Mode: APPLY (will write)" : "Mode: DRY-RUN (no writes)");

  const board = await resolveEdexcelBoard();
  console.log(`Exam board: ${board.name} (${board.code}) id=${board.id}`);
  console.log(`Centre number: ${FIXED_CENTRE_NUMBER}`);

  const candidates = await prisma.candidate.findMany({
    select: {
      id: true,
      englishName: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      studentNumber: true,
      assessmentHubCandidateNumber: true,
    },
  });

  const summary = {
    matched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    ambiguous: 0,
    unmatched: 0,
  };

  for (const row of excelRows) {
    const matches = candidates.filter((candidate) => candidateMatchesExcel(candidate, row));

    if (matches.length === 0) {
      summary.unmatched += 1;
      console.warn(
        `UNMATCHED row ${row.rowNumber}: ${row.firstName} ${row.lastName} DOB=${row.dobRaw} UCI=${row.uciNumber}`,
      );
      continue;
    }

    if (matches.length > 1) {
      summary.ambiguous += 1;
      console.warn(
        `AMBIGUOUS row ${row.rowNumber}: ${row.firstName} ${row.lastName} DOB=${row.dobRaw} → ${matches
          .map((m) => `${m.englishName} (${m.assessmentHubCandidateNumber})`)
          .join("; ")}`,
      );
      continue;
    }

    const candidate = matches[0]!;
    summary.matched += 1;

    const existing = await prisma.candidateExamIdentity.findUnique({
      where: {
        candidateId_examBoardId: {
          candidateId: candidate.id,
          examBoardId: board.id,
        },
      },
      select: {
        id: true,
        centreNumber: true,
        candidateNumber: true,
        uciNumber: true,
        status: true,
      },
    });

    const next = {
      centreNumber: FIXED_CENTRE_NUMBER,
      candidateNumber: row.candidateNumber,
      uciNumber: row.uciNumber,
      status: existing?.status ?? ("PENDING" as const),
    };

    const same =
      existing &&
      (existing.centreNumber ?? "") === next.centreNumber &&
      (existing.candidateNumber ?? "") === next.candidateNumber &&
      (existing.uciNumber ?? "") === next.uciNumber;

    if (same) {
      summary.unchanged += 1;
      console.log(
        `OK (unchanged) row ${row.rowNumber}: ${candidate.englishName} ← UCI ${row.uciNumber}`,
      );
      continue;
    }

    console.log(
      `${existing ? "UPDATE" : "CREATE"} row ${row.rowNumber}: ${candidate.englishName} (${candidate.assessmentHubCandidateNumber}` +
        `${candidate.studentNumber ? ` / ${candidate.studentNumber}` : ""})` +
        ` ← centre ${FIXED_CENTRE_NUMBER}, cand ${row.candidateNumber}, UCI ${row.uciNumber}` +
        (existing?.uciNumber ? ` (was UCI ${existing.uciNumber})` : ""),
    );

    if (!apply) continue;

    await upsertCandidateExamIdentity(candidate.id, board.id, {
      centreNumber: next.centreNumber,
      candidateNumber: next.candidateNumber,
      uciNumber: next.uciNumber,
      status: next.status,
    });

    if (existing) summary.updated += 1;
    else summary.created += 1;
  }

  console.log("\nSummary");
  console.log(summary);
  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write changes.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
