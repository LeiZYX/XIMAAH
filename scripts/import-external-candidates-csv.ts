/**
 * Import External candidates (profile + board UCI / Cand No) using DATABASE_URL.
 *
 * Matching order (existing External):
 *   externalId → Assessment Hub number → UCI → ID / passport number
 *
 * Dry-run by default (no writes). Pass --apply to write.
 *
 * Usage:
 *   npx tsx scripts/import-external-candidates-csv.ts "/path/to/file.csv"
 *   npx tsx scripts/import-external-candidates-csv.ts "/path/to/file.xlsx" --apply
 *
 * Production example:
 *   DATABASE_URL="mysql://user:pass@host:3306/xima" \
 *     npx tsx scripts/import-external-candidates-csv.ts ./external-partner-bj.csv --apply
 *
 * Docker (if app container has the file mounted):
 *   docker compose exec -e DATABASE_URL app \
 *     npx tsx scripts/import-external-candidates-csv.ts /data/external.csv --apply
 *
 * CSV/Excel headers (aliases OK): candidateType, chineseName, surnamePinyin, givenNamePinyin,
 * gender, examBoard, centreNumber, uci, boardCandidateNumber|boardCandidateId, externalId, schoolName, ...
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  importCandidates,
  normalizeCandidateImportRow,
  type CandidateImportRow,
} from "../src/lib/candidates/import";
import { parseCandidateTypeInput } from "../src/lib/candidates/export";
import { equalsFilter } from "../src/lib/db/string-filters";
import { exitAfterPrismaScript, prisma } from "../src/lib/prisma";

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/import-external-candidates-csv.ts <file.csv|file.xlsx> [--apply]

Dry-run prints create/update plan. --apply writes to the DB from DATABASE_URL.`);
  process.exit(1);
}

function loadRows(filePath: string): Record<string, string>[] {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${absolute}`);
  }

  const lower = absolute.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buffer = fs.readFileSync(absolute);
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    return json.map((row) => {
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        out[key] = String(value ?? "").trim();
      }
      return out;
    });
  }

  // CSV (with basic quoted-field support)
  const text = fs.readFileSync(absolute, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseLine(lines[0]!).map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").replace(/^"|"$/g, "").trim();
    });
    return row;
  });
}

async function previewMatch(row: CandidateImportRow) {
  const externalId = row.externalId?.trim();
  if (externalId) {
    const hit = await prisma.candidate.findFirst({
      where: { candidateType: "EXTERNAL", externalId: equalsFilter(externalId) },
      select: { id: true, englishName: true, externalId: true },
    });
    if (hit) return { action: "update" as const, via: "externalId", hit };
  }

  const hub = row.assessmentHubCandidateNumber?.trim();
  if (hub) {
    const hit = await prisma.candidate.findFirst({
      where: {
        candidateType: "EXTERNAL",
        assessmentHubCandidateNumber: equalsFilter(hub),
      },
      select: { id: true, englishName: true, externalId: true },
    });
    if (hit) return { action: "update" as const, via: "assessmentHubCandidateNumber", hit };
  }

  const uci = row.uci?.trim();
  if (uci) {
    const hit = await prisma.candidate.findFirst({
      where: {
        candidateType: "EXTERNAL",
        examIdentities: { some: { uciNumber: equalsFilter(uci) } },
      },
      select: { id: true, englishName: true, externalId: true },
    });
    if (hit) return { action: "update" as const, via: "uci", hit };
  }

  const idDoc = row.idDocumentNumber?.trim();
  if (idDoc) {
    const hit = await prisma.candidate.findFirst({
      where: {
        candidateType: "EXTERNAL",
        idDocumentNumber: equalsFilter(idDoc),
      },
      select: { id: true, englishName: true, externalId: true },
    });
    if (hit) return { action: "update" as const, via: "idDocumentNumber", hit };
  }

  return { action: "create" as const, via: null, hit: null };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  if (!fileArg) usage();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const rawRows = loadRows(fileArg);
  if (rawRows.length === 0) {
    throw new Error("No data rows found in file");
  }

  console.log(`File: ${path.resolve(fileArg)}`);
  console.log(`DATABASE_URL host hint: ${process.env.DATABASE_URL.replace(/:[^:@/]+@/, ":****@")}`);
  console.log(`Rows: ${rawRows.length}`);
  console.log(`Mode: ${apply ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
  console.log("");

  let wouldCreate = 0;
  let wouldUpdate = 0;

  for (const [index, raw] of rawRows.entries()) {
    const row = normalizeCandidateImportRow(raw);
    row.candidateType = parseCandidateTypeInput(row.candidateType) ?? "EXTERNAL";
    if (row.candidateType !== "EXTERNAL") {
      console.warn(
        `Row ${index + 1}: candidateType=${row.candidateType} (script expects EXTERNAL; will still import as given)`,
      );
    }

    const preview = await previewMatch(row);
    if (preview.action === "create") {
      wouldCreate += 1;
      console.log(
        `Row ${index + 1}: CREATE  ${row.chineseName ?? "?"} / ${row.surnamePinyin ?? ""} ${row.givenNamePinyin ?? ""}  externalId=${row.externalId ?? "—"}  uci=${row.uci ?? "—"}`,
      );
    } else {
      wouldUpdate += 1;
      console.log(
        `Row ${index + 1}: UPDATE  via ${preview.via} → ${preview.hit?.englishName} (${preview.hit?.id})  externalId=${row.externalId ?? "—"}  uci=${row.uci ?? "—"}`,
      );
    }
  }

  console.log("");
  console.log(`Plan: create ${wouldCreate}, update ${wouldUpdate}`);

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to write.");
    return;
  }

  const result = await importCandidates(
    rawRows.map((raw) => {
      const row = normalizeCandidateImportRow(raw);
      return {
        ...row,
        candidateType: parseCandidateTypeInput(row.candidateType) ?? "EXTERNAL",
      };
    }),
  );

  console.log("");
  console.log(
    `Done: created ${result.created}, updated ${result.updated}, skipped ${result.skipped}`,
  );
  if (result.errors.length > 0) {
    console.log("Errors:");
    for (const message of result.errors) console.log(`  - ${message}`);
  }
}

main()
  .then(async () => {
    await exitAfterPrismaScript(prisma, 0);
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await exitAfterPrismaScript(prisma, 1);
  });
