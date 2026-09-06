"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { CandidatesSubnav } from "@/components/candidates/CandidatesSubnav";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { CANDIDATES_MODULE_DESCRIPTION } from "@/lib/navigation/module-descriptions";

export default function CandidateImportExportPage() {
  const pathname = usePathname();
  const moduleBasePath = pathname.startsWith("/exam-office")
    ? "/exam-office/candidates"
    : "/admin/candidates";
  const importApiPath = pathname.startsWith("/exam-office")
    ? "/api/exam-office/candidates/import"
    : "/api/admin/candidates/import";

  const [raw, setRaw] = useState("");
  const [markMissingInactive, setMarkMissingInactive] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setError(null);
    setResult(null);
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setError("Paste CSV with header row and at least one data row.");
      return;
    }
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() ?? "";
      });
      return row;
    });

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
  }

  return (
    <div className="space-y-6">
      <CandidatesSubnav basePath={moduleBasePath} />
      <PageHeader
        title="Import / Export"
        description={`${CANDIDATES_MODULE_DESCRIPTION} Bulk import Internal or External candidates from CSV (External can include UCI and board Candidate Number in one file).`}
      />
      <Card className="space-y-4">
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            Set <span className="font-mono text-slate-800">candidateType=EXTERNAL</span> to create
            external candidates. One row can include profile fields plus board identity.
          </p>
          <p>
            <span className="font-medium text-slate-800">Profile:</span> chineseName, surnamePinyin /
            givenNamePinyin (or firstName / lastName), preferredEnglishName, gender, dateOfBirth,
            idDocumentType, idDocumentNumber, email, phone, schoolName, externalId
          </p>
          <p>
            <span className="font-medium text-slate-800">Board (same row):</span> examBoard, centreNumber,
            uci, boardCandidateNumber (Cand No). If examBoard is blank and UCI is present, Pearson
            Edexcel is used when available. Centre defaults to the exam board centre when omitted.
          </p>
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
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          placeholder='candidateType,chineseName,surnamePinyin,givenNamePinyin,gender,dateOfBirth,...'
        />
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
          onClick={() => void handleImport()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          Import
        </button>
        {result ? <p className="text-sm text-green-700">{result}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </Card>
    </div>
  );
}
