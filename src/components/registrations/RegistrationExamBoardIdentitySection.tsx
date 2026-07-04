"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { candidateExamIdentityStatusLabel } from "@/lib/candidates/exam-board-identity.shared";
import { EXAM_BOARD_IDENTITIES_TAB } from "@/lib/navigation/candidate-board-registration";
import type { CandidateExamIdentityStatus } from "@/generated/prisma/enums";

export type RegistrationExamBoardIdentity = {
  id: string;
  centreNumber: string | null;
  candidateNumber: string | null;
  uciNumber: string | null;
  status: CandidateExamIdentityStatus;
  examBoard: { id: string; name: string; code: string };
};

export function RegistrationExamBoardIdentitySection({
  candidateId,
  examBoardId,
  examBoardName,
  candidateDetailBasePath,
}: {
  candidateId: string | null;
  examBoardId: string | null;
  examBoardName?: string | null;
  candidateDetailBasePath: string;
}) {
  const [loading, setLoading] = useState(false);
  const [identity, setIdentity] = useState<RegistrationExamBoardIdentity | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!candidateId || !examBoardId) {
      setIdentity(null);
      setResolved(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setResolved(false);

    fetch(`/api/candidates/${candidateId}/board-identity?examBoardId=${encodeURIComponent(examBoardId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setIdentity(data?.identity ?? null);
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIdentity(null);
        setResolved(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [candidateId, examBoardId]);

  if (!candidateId || !examBoardId) return null;

  const readOnlyClass =
    "w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700";

  if (loading) {
    return <p className="text-sm text-slate-500">Loading exam board identity...</p>;
  }

  if (resolved && !identity) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">No Exam Board Identity exists for this student.</p>
        {examBoardName ? (
          <p className="mt-1 text-amber-800">
            Exam board: <span className="font-medium">{examBoardName}</span>
          </p>
        ) : null}
        <p className="mt-2 text-amber-800">
          You can still submit this registration. Add board numbers later when they are available.
        </p>
        <Link
          href={`${candidateDetailBasePath}/${candidateId}?tab=${EXAM_BOARD_IDENTITIES_TAB}`}
          className="mt-3 inline-flex rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
          target="_blank"
          rel="noreferrer"
        >
          Create Exam Board Identity
        </Link>
      </div>
    );
  }

  if (!identity) return null;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="text-sm font-medium text-slate-900">Exam Board Identity</h3>
        <p className="text-xs text-slate-500">
          Loaded from the candidate&apos;s board registration record. These fields cannot be edited here.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Exam Board</span>
          <input readOnly value={identity.examBoard.name} className={readOnlyClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Status</span>
          <input
            readOnly
            value={candidateExamIdentityStatusLabel(identity.status)}
            className={readOnlyClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Centre Number</span>
          <input readOnly value={identity.centreNumber ?? "—"} className={readOnlyClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Candidate Number</span>
          <input readOnly value={identity.candidateNumber ?? "—"} className={readOnlyClass} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">UCI Number</span>
          <input readOnly value={identity.uciNumber ?? "—"} className={readOnlyClass} />
        </label>
      </div>
    </div>
  );
}
