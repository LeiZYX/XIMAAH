"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AdminCandidateImportPage() {
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

    const response = await fetch("/api/admin/candidates/import", {
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
      <PageHeader
        title="Import internal candidates"
        description="Upsert by studentNumber or externalId. Missing candidates are not deleted automatically."
      />
      <p className="text-sm">
        <Link href="/admin/candidates" className="text-indigo-600 hover:underline">
          Back to candidates
        </Link>
      </p>
      <Card className="space-y-4">
        <p className="text-sm text-slate-600">
          CSV headers: studentNumber, englishName, chineseName, email, phone, grade, className,
          externalId, assessmentHubCandidateNumber
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
