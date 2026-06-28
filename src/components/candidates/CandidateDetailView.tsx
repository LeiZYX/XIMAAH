"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { candidateStatusLabel, candidateTypeLabel } from "@/lib/candidates/labels";

export function CandidateDetailView({
  candidateId,
  apiPath,
  backHref,
}: {
  candidateId: string;
  apiPath: string;
  backHref: string;
}) {
  const [candidate, setCandidate] = useState<Record<string, unknown> | null>(null);
  const [examBoards, setExamBoards] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [identityForm, setIdentityForm] = useState({
    examBoardId: "",
    centreNumber: "",
    boardCandidateNumber: "",
    uci: "",
    notes: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch(`${apiPath}/${candidateId}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to load candidate");
      return;
    }
    setCandidate(data);
  }

  useEffect(() => {
    void load();
    fetch("/api/exam-boards")
      .then((r) => r.json())
      .then((data) => setExamBoards(Array.isArray(data) ? data : []))
      .catch(() => setExamBoards([]));
  }, [apiPath, candidateId]);

  async function saveIdentity() {
    setError(null);
    setMessage(null);
    const response = await fetch(`${apiPath}/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examIdentity: identityForm }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not save exam identity");
      return;
    }
    setMessage("Exam board identity saved.");
    setCandidate(data);
  }

  if (!candidate) {
    return <p className="text-sm text-slate-500">{error ?? "Loading candidate..."}</p>;
  }

  const identities = (candidate.examIdentities as Array<Record<string, unknown>>) ?? [];
  const workspaces = (candidate.registrationWorkspaces as Array<Record<string, unknown>>) ?? [];
  const feeStatements = (candidate.feeStatements as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={String(candidate.englishName)}
        description={`Assessment Hub candidate ${String(candidate.assessmentHubCandidateNumber)}`}
      />
      <p className="text-sm">
        <Link href={backHref} className="text-indigo-600 hover:underline">
          Back to candidates
        </Link>
      </p>

      <Card className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <span className="text-slate-500">AH Candidate Number</span>
          <p className="font-medium font-mono">{String(candidate.assessmentHubCandidateNumber)}</p>
        </div>
        <div>
          <span className="text-slate-500">Candidate Type</span>
          <p className="font-medium">{candidateTypeLabel(candidate.candidateType as never)}</p>
        </div>
        <div>
          <span className="text-slate-500">Student Number</span>
          <p className="font-medium">{String(candidate.studentNumber ?? "—")}</p>
        </div>
        <div>
          <span className="text-slate-500">Status</span>
          <p className="font-medium">{candidateStatusLabel(candidate.status as never)}</p>
        </div>
        <div>
          <span className="text-slate-500">Grade / Class</span>
          <p className="font-medium">
            {String(candidate.grade ?? "—")} / {String(candidate.className ?? "—")}
          </p>
        </div>
        <div>
          <span className="text-slate-500">Login enabled</span>
          <p className="font-medium">{candidate.loginEnabled ? "Yes" : "No"}</p>
        </div>
        <div>
          <span className="text-slate-500">Email / Phone</span>
          <p className="font-medium">
            {String(candidate.email ?? "—")} · {String(candidate.phone ?? "—")}
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Exam board identities</h2>
        {identities.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">No exam board identities yet.</p>
        ) : (
          <table className="mb-4 min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Board</th>
                <th className="py-2 pr-3">Centre</th>
                <th className="py-2 pr-3">Board candidate no.</th>
                <th className="py-2 pr-3">UCI</th>
              </tr>
            </thead>
            <tbody>
              {identities.map((identity) => {
                const board = identity.examBoard as { name: string };
                return (
                  <tr key={String(identity.id)} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{board.name}</td>
                    <td className="py-2 pr-3">{String(identity.centreNumber ?? "—")}</td>
                    <td className="py-2 pr-3">{String(identity.boardCandidateNumber ?? "—")}</td>
                    <td className="py-2 pr-3">{String(identity.uci ?? "—")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={identityForm.examBoardId}
            onChange={(e) => setIdentityForm({ ...identityForm, examBoardId: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select exam board</option>
            {examBoards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Centre number"
            value={identityForm.centreNumber}
            onChange={(e) => setIdentityForm({ ...identityForm, centreNumber: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Board candidate number"
            value={identityForm.boardCandidateNumber}
            onChange={(e) =>
              setIdentityForm({ ...identityForm, boardCandidateNumber: e.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="UCI (Pearson)"
            value={identityForm.uci}
            onChange={(e) => setIdentityForm({ ...identityForm, uci: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void saveIdentity()}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          Save exam board identity
        </button>
        {message ? <p className="mt-2 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">Registration history</h2>
        {workspaces.length === 0 ? (
          <p className="text-sm text-slate-500">No registrations yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {workspaces.map((workspace) => {
              const window = workspace.registrationWindow as { title: string };
              return (
                <li key={String(workspace.id)}>
                  {window.title} · {String((workspace.registrations as unknown[])?.length ?? 0)} exam(s)
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">Fee statements</h2>
        {feeStatements.length === 0 ? (
          <p className="text-sm text-slate-500">No fee statements yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {feeStatements.map((statement) => (
              <li key={String(statement.id)}>
                {String(statement.statementNo)} · {String(statement.status)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
