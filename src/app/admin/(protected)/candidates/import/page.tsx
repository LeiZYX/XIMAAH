"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import * as XLSX from "xlsx";
import { CandidatesSubnav } from "@/components/candidates/CandidatesSubnav";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { CANDIDATES_MODULE_DESCRIPTION } from "@/lib/navigation/module-descriptions";

function parseCsvText(raw: string): Record<string, string>[] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
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

function rowsFromWorkbook(buffer: ArrayBuffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
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

export default function CandidateImportExportPage() {
  const pathname = usePathname();
  const moduleBasePath = pathname.startsWith("/exam-office")
    ? "/exam-office/candidates"
    : "/admin/candidates";
  const importApiPath = pathname.startsWith("/exam-office")
    ? "/api/exam-office/candidates/import"
    : "/api/admin/candidates/import";

  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [markMissingInactive, setMarkMissingInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runImport(rows: Record<string, string>[]) {
    setError(null);
    setResult(null);
    if (rows.length === 0) {
      setError("No data rows found. Use a header row plus at least one data row.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(importApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, markMissingInactive }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setResult(
        `Created ${data.created}, updated ${data.updated}, skipped ${data.skipped}.` +
          (data.errors?.length ? ` Errors: ${data.errors.join("; ")}` : ""),
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleImportPasted() {
    await runImport(parseCsvText(raw));
  }

  async function handleFileSelected(file: File | null) {
    setError(null);
    setResult(null);
    setFileName(null);
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) {
      setError("Please upload a .csv or .xlsx file.");
      return;
    }

    setFileName(file.name);
    try {
      if (lower.endsWith(".csv")) {
        const text = await file.text();
        setRaw(text);
        await runImport(parseCsvText(text));
        return;
      }

      const buffer = await file.arrayBuffer();
      const rows = rowsFromWorkbook(buffer);
      setRaw("");
      await runImport(rows);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not read file");
    }
  }

  return (
    <div className="space-y-6">
      <CandidatesSubnav basePath={moduleBasePath} />
      <PageHeader
        title="Import / Export"
        description={`${CANDIDATES_MODULE_DESCRIPTION} Bulk import Internal or External candidates from CSV/Excel (External can include UCI and board Candidate Number in one file).`}
      />
      <Card className="space-y-4">
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            This page imports both Internal and External candidates. For external students, set{" "}
            <span className="font-mono text-slate-800">candidateType=EXTERNAL</span>.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-800">Required for External</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <span className="font-mono">candidateType</span> = EXTERNAL
              </li>
              <li>
                <span className="font-mono">chineseName</span>
              </li>
              <li>
                Name pair: <span className="font-mono">surnamePinyin</span> +{" "}
                <span className="font-mono">givenNamePinyin</span>{" "}
                <span className="text-slate-500">(or firstName + lastName)</span>
              </li>
              <li>
                <span className="font-mono">gender</span> (MALE / FEMALE / …)
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="font-medium text-slate-800">Optional</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <span className="font-mono">dateOfBirth</span>,{" "}
                <span className="font-mono">idDocumentType</span>,{" "}
                <span className="font-mono">idDocumentNumber</span> (allowed blank for External)
              </li>
              <li>
                Profile: preferredEnglishName, email, phone, schoolName, externalId,
                assessmentHubCandidateNumber (auto-generated if blank)
              </li>
              <li>
                Board (same row): examBoard, centreNumber, uci, boardCandidateNumber — all optional;
                omit all to skip board identity. If any board field is set, Centre is required (or
                taken from the exam board default). Blank examBoard + UCI defaults to Pearson Edexcel
                when available.
              </li>
            </ul>
          </div>
          <p>
            Re-import updates an existing External candidate matched by{" "}
            <span className="font-mono">externalId</span>, then Assessment Hub number, then ID /
            passport number.
          </p>
        </div>
        <p className="flex flex-wrap gap-4 text-sm text-slate-600">
          <a
            href={`${importApiPath}/external-sample`}
            className="font-medium text-indigo-600 hover:underline"
          >
            Download External sample CSV
          </a>
          <a
            href={`${importApiPath.replace("/import", "/export")}`}
            className="font-medium text-indigo-600 hover:underline"
          >
            Download export of current candidates
          </a>
        </p>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800">Upload CSV or Excel</label>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={loading}
            onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {fileName ? <p className="text-xs text-slate-500">Selected: {fileName}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800">Or paste CSV</label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            placeholder="candidateType,chineseName,surnamePinyin,givenNamePinyin,gender,dateOfBirth,..."
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={markMissingInactive}
            onChange={(e) => setMarkMissingInactive(e.target.checked)}
          />
          Mark Internal candidates not in this import as inactive (External rows are not affected)
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleImportPasted()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Importing…" : "Import pasted CSV"}
        </button>
        {result ? <p className="text-sm text-green-700">{result}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </Card>
    </div>
  );
}
