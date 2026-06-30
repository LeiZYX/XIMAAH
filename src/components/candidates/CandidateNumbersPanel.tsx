"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CandidatesSubnav } from "@/components/candidates/CandidatesSubnav";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { candidateTypeLabel } from "@/lib/candidates/labels";
import { CANDIDATES_MODULE_DESCRIPTION } from "@/lib/navigation/module-descriptions";
import { LIST_PAGE_SIZES } from "@/lib/pagination";

interface ExamIdentity {
  examBoard: { code: string; name: string };
  boardCandidateNumber: string | null;
  uci: string | null;
  centreNumber: string | null;
}

interface CandidateRow {
  id: string;
  assessmentHubCandidateNumber: string;
  candidateType: string;
  englishName: string;
  chineseName: string | null;
  studentNumber: string | null;
  examIdentities: ExamIdentity[];
}

interface IdentityRow {
  candidateId: string;
  assessmentHubCandidateNumber: string;
  candidateName: string;
  candidateType: string;
  studentNumber: string | null;
  examBoardCode: string;
  examBoardName: string;
  boardCandidateNumber: string;
  uci: string;
  centreNumber: string;
}

function flattenIdentityRows(candidates: CandidateRow[]): IdentityRow[] {
  const rows: IdentityRow[] = [];
  for (const candidate of candidates) {
    const candidateName = candidate.chineseName
      ? `${candidate.englishName} (${candidate.chineseName})`
      : candidate.englishName;
    if (candidate.examIdentities.length === 0) {
      rows.push({
        candidateId: candidate.id,
        assessmentHubCandidateNumber: candidate.assessmentHubCandidateNumber,
        candidateName,
        candidateType: candidate.candidateType,
        studentNumber: candidate.studentNumber,
        examBoardCode: "—",
        examBoardName: "—",
        boardCandidateNumber: "—",
        uci: "—",
        centreNumber: "—",
      });
      continue;
    }
    for (const identity of candidate.examIdentities) {
      rows.push({
        candidateId: candidate.id,
        assessmentHubCandidateNumber: candidate.assessmentHubCandidateNumber,
        candidateName,
        candidateType: candidate.candidateType,
        studentNumber: candidate.studentNumber,
        examBoardCode: identity.examBoard.code,
        examBoardName: identity.examBoard.name,
        boardCandidateNumber: identity.boardCandidateNumber ?? "—",
        uci: identity.uci ?? "—",
        centreNumber: identity.centreNumber ?? "—",
      });
    }
  }
  return rows;
}

export function CandidateNumbersPanel({
  apiPath,
  detailBasePath,
  moduleBasePath,
}: {
  apiPath: string;
  detailBasePath: string;
  moduleBasePath: string;
}) {
  const [rows, setRows] = useState<IdentityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const response = await fetch(`${apiPath}?${params.toString()}`);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load candidate numbers");
      }
      const candidates = Array.isArray(data.candidates) ? (data.candidates as CandidateRow[]) : [];
      setRows(flattenIdentityRows(candidates));
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      if (typeof data.page === "number") setPage(data.page);
    } catch (loadError) {
      setRows([]);
      setTotal(0);
      setTotalPages(0);
      setError(loadError instanceof Error ? loadError.message : "Failed to load candidate numbers");
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <CandidatesSubnav basePath={moduleBasePath} />
      <PageHeader
        title="Candidate Numbers"
        description={`${CANDIDATES_MODULE_DESCRIPTION} Review Assessment Hub numbers and board identifiers (candidate number, UCI, centre number).`}
      />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <input
            placeholder="Search name, AH number, or student number"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            Search
          </button>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {loading && rows.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No candidate numbers match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">AH No.</th>
                  <th className="py-2 pr-3">Candidate</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Student No.</th>
                  <th className="py-2 pr-3">Board</th>
                  <th className="py-2 pr-3">Board candidate no.</th>
                  <th className="py-2 pr-3">UCI</th>
                  <th className="py-2 pr-3">Centre no.</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.candidateId}-${row.examBoardCode}-${index}`} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-mono text-xs">{row.assessmentHubCandidateNumber}</td>
                    <td className="py-2 pr-3">{row.candidateName}</td>
                    <td className="py-2 pr-3">{candidateTypeLabel(row.candidateType)}</td>
                    <td className="py-2 pr-3">{row.studentNumber ?? "—"}</td>
                    <td className="py-2 pr-3">{row.examBoardCode}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.boardCandidateNumber}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.uci}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.centreNumber}</td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`${detailBasePath}/${row.candidateId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          loading={loading}
          itemLabel="candidates"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </Card>
    </div>
  );
}
