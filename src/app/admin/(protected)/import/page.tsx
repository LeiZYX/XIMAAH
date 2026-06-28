"use client";

import { FormEvent, useState } from "react";
import { AqaImportPanel } from "@/components/admin/AqaImportPanel";
import { EdexcelImportPanel } from "@/components/admin/EdexcelImportPanel";
import { ImportPreviewPanel } from "@/components/admin/ImportPreviewPanel";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const EXAMPLE_CSV = `entity,examBoardCode,level,name,code
qualification,CIE,IGCSE,Mathematics,0580

entity,examBoardCode,level,name,code,title
subject,CIE,IGCSE,Mathematics,0580,Mathematics

entity,examBoardCode,subjectCode,code,title,duration
paper,CIE,0580,0580/21,Paper 2 Extended,120

entity,examBoardCode,name,year
exam_series,CIE,June 2026,2026

entity,examBoardCode,paperCode,seriesName,year,date,startTime,endTime,venue
exam_session,CIE,0580/21,June 2026,2026,2026-05-08,09:00,11:00,Hall A

entity,examBoardCode,seriesName,year,title,date,type
key_date,CIE,June 2026,2026,Entry Deadline,2026-02-15,DEADLINE`;

export default function ImportPage() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });

    setResult(await response.json());
    setLoading(false);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <div>
      <PageHeader
        title="Import Data"
        description="Bulk import from CSV using exam board codes (AQA, CIE, EDEXCEL) — no database IDs needed."
      />

      <AqaImportPanel />

      <EdexcelImportPanel />

      <ImportPreviewPanel
        title="Pearson Edexcel (Excel preview)"
        description="Parse an official Pearson Edexcel XLSX timetable via the Python data-processor, validate rows, then confirm import."
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        previewEndpoint="/api/import/preview/pearson-excel"
        source="pearson-excel"
        accent="sky"
      />

      <ImportPreviewPanel
        title="Cambridge International (PDF preview)"
        description="Parse a Cambridge IGCSE/A Level timetable PDF, review extracted sessions, then import."
        accept="application/pdf,.pdf"
        previewEndpoint="/api/import/preview/cambridge-pdf"
        source="cambridge-pdf"
        accent="violet"
      />

      <ImportPreviewPanel
        title="Oxford AQA (PDF preview)"
        description="Parse an Oxford AQA timetable PDF with preview and validation before committing to the database."
        accept="application/pdf,.pdf"
        previewEndpoint="/api/import/preview/oxfordaqa-pdf"
        source="oxfordaqa-pdf"
      />

      <Card className="mb-6 border-indigo-100 bg-indigo-50">
        <h2 className="text-sm font-semibold text-indigo-900">Recommended workflow</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-indigo-800">
          <li>
            Run <code className="rounded bg-white px-1">npm run db:seed</code> to create AQA, CIE,
            Edexcel
          </li>
          <li>Download the exam timetable from the board website (PDF/Excel)</li>
          <li>Convert rows to CSV using the templates below</li>
          <li>Import in order: qualification → subject → paper → exam_series → exam_session → key_date</li>
          <li>Check results on the Calendar page</li>
        </ol>
        <p className="mt-3 text-sm text-indigo-800">
          Duplicate records are skipped automatically. Lines starting with <code>#</code> are
          ignored.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Upload CSV</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                CSV file
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-600"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Or paste CSV content
              </span>
              <textarea
                value={csv}
                onChange={(event) => setCsv(event.target.value)}
                rows={16}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                placeholder="Paste CSV here..."
                required
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Importing..." : "Import"}
              </button>
              <button
                type="button"
                onClick={() => setCsv(EXAMPLE_CSV)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Load example
              </button>
            </div>
          </form>

          {result ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">
                Created {result.created} · Skipped {result.skipped ?? 0} duplicate
                {(result.skipped ?? 0) === 1 ? "" : "s"}
              </p>
              {result.errors.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-red-600">
                  {result.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">CSV templates (use codes, not IDs)</h2>

          <div className="space-y-4 text-sm text-slate-700">
            <div>
              <p className="font-medium">Qualification</p>
              <code className="mt-1 block whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs">
                {`entity,examBoardCode,level,name,code
qualification,CIE,IGCSE,Mathematics,0580`}
              </code>
            </div>
            <div>
              <p className="font-medium">Subject</p>
              <code className="mt-1 block whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs">
                {`entity,examBoardCode,level,name,code,title
subject,CIE,IGCSE,Mathematics,0580,Mathematics`}
              </code>
            </div>
            <div>
              <p className="font-medium">Paper</p>
              <code className="mt-1 block whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs">
                {`entity,examBoardCode,subjectCode,code,title,duration
paper,CIE,0580,0580/21,Paper 2 Extended,120`}
              </code>
            </div>
            <div>
              <p className="font-medium">Exam series</p>
              <code className="mt-1 block whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs">
                {`entity,examBoardCode,name,year
exam_series,CIE,June 2026,2026`}
              </code>
            </div>
            <div>
              <p className="font-medium">Exam session</p>
              <code className="mt-1 block whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs">
                {`entity,examBoardCode,paperCode,seriesName,year,date,startTime,endTime,venue
exam_session,CIE,0580/21,June 2026,2026,2026-05-08,09:00,11:00,Hall A`}
              </code>
            </div>
            <div>
              <p className="font-medium">Key date</p>
              <code className="mt-1 block whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs">
                {`entity,examBoardCode,seriesName,year,title,date,type
key_date,AQA,Summer 2026,2026,Results Day,2026-08-20,RESULTS`}
              </code>
              <p className="mt-1 text-xs text-slate-500">
                type: DEADLINE · RESULTS · REGISTRATION · OTHER
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            Full example file: <code>prisma/import-example.csv</code> in the project folder.
          </p>
        </Card>
      </div>
    </div>
  );
}
