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
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",");
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
        description={`${CANDIDATES_MODULE_DESCRIPTION} Bulk import internal candidates from CSV; export is available from the candidate list.`}
      />
      <Card className="space-y-4">
        <p className="text-sm text-slate-600">
          CSV headers: chineseName, surnamePinyin, givenNamePinyin, preferredEnglishName, legalEnglishName,
          gender, dateOfBirth, nationality, idDocumentType, idDocumentNumber, email, phone, candidateType,
          studentNumber, grade, className, graduationYear, assessmentHubCandidateNumber, uci,
          boardCandidateNumber, emergencyContactName, emergencyContactPhone
        </p>
        <p className="text-sm text-slate-600">
          <a
            href={`${importApiPath.replace("/import", "/export")}`}
            className="font-medium text-indigo-600 hover:underline"
          >
            Download export template (current candidates)
          </a>
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          placeholder="studentNumber,englishName,grade,className"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={markMissingInactive}
            onChange={(e) => setMarkMissingInactive(e.target.checked)}
          />
          Mark candidates not in this import as inactive (requires explicit confirmation)
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
