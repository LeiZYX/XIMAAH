"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CANDIDATE_EXAM_IDENTITY_STATUS_OPTIONS,
  candidateExamIdentityStatusLabel,
  examBoardIdentityRules,
  formatRegisteredAt,
  validateExamBoardIdentityInput,
} from "@/lib/candidates/exam-board-identity.shared";
import type { CandidateExamIdentityStatus } from "@/generated/prisma/enums";

type ExamBoard = { id: string; name: string; code: string };

export type CandidateExamIdentityRecord = {
  id: string;
  examBoardId: string;
  centreNumber: string | null;
  candidateNumber: string | null;
  uciNumber: string | null;
  status: CandidateExamIdentityStatus;
  registeredAt: string | null;
  notes: string | null;
  examBoard: ExamBoard;
};

export type CandidateExamIdentityFormPayload = {
  id?: string;
  examBoardId: string;
  centreNumber: string;
  candidateNumber: string;
  uciNumber: string;
  status: CandidateExamIdentityStatus;
  notes: string;
};

type FormMode = "create" | "edit" | null;

const emptyForm = (): Omit<CandidateExamIdentityFormPayload, "examBoardId"> & { examBoardId: string } => ({
  examBoardId: "",
  centreNumber: "",
  candidateNumber: "",
  uciNumber: "",
  status: "PENDING",
  notes: "",
});

export function CandidateExamBoardIdentitiesTab({
  identities,
  examBoards,
  readOnly,
  saving,
  onSave,
  onArchive,
}: {
  identities: CandidateExamIdentityRecord[];
  examBoards: ExamBoard[];
  readOnly: boolean;
  saving: boolean;
  onSave: (payload: CandidateExamIdentityFormPayload) => Promise<void>;
  onArchive: (identityId: string) => Promise<void>;
}) {
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingIdentity, setEditingIdentity] = useState<CandidateExamIdentityRecord | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const usedBoardIds = useMemo(
    () => new Set(identities.map((identity) => identity.examBoardId)),
    [identities],
  );

  const selectedBoard = useMemo(() => {
    const boardId = formMode === "edit" ? editingIdentity?.examBoardId : form.examBoardId;
    return examBoards.find((board) => board.id === boardId) ?? editingIdentity?.examBoard ?? null;
  }, [examBoards, editingIdentity, form.examBoardId, formMode]);

  const boardRules = useMemo(
    () =>
      selectedBoard
        ? examBoardIdentityRules(selectedBoard.code, selectedBoard.name)
        : { centreNumberRequired: true, candidateNumberRequired: false, uciNumberAllowed: false },
    [selectedBoard],
  );

  const availableBoards = useMemo(
    () =>
      examBoards.filter(
        (board) => formMode === "edit" && editingIdentity?.examBoardId === board.id
          ? true
          : !usedBoardIds.has(board.id),
      ),
    [examBoards, editingIdentity?.examBoardId, formMode, usedBoardIds],
  );

  function openCreate() {
    setFormMode("create");
    setEditingIdentity(null);
    setForm(emptyForm());
    setFormError(null);
  }

  function openEdit(identity: CandidateExamIdentityRecord) {
    setFormMode("edit");
    setEditingIdentity(identity);
    setForm({
      examBoardId: identity.examBoardId,
      centreNumber: identity.centreNumber ?? "",
      candidateNumber: identity.candidateNumber ?? "",
      uciNumber: identity.uciNumber ?? "",
      status: identity.status,
      notes: identity.notes ?? "",
    });
    setFormError(null);
  }

  function closeForm() {
    setFormMode(null);
    setEditingIdentity(null);
    setForm(emptyForm());
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedBoard) {
      setFormError("Exam Board is required");
      return;
    }

    const payload: CandidateExamIdentityFormPayload = {
      ...(formMode === "edit" && editingIdentity ? { id: editingIdentity.id } : {}),
      examBoardId: selectedBoard.id,
      centreNumber: form.centreNumber,
      candidateNumber: form.candidateNumber,
      uciNumber: form.uciNumber,
      status: form.status,
      notes: form.notes,
    };

    const validationErrors = validateExamBoardIdentityInput(
      selectedBoard.code,
      payload,
      selectedBoard.name,
    );
    if (validationErrors.length > 0) {
      setFormError(validationErrors.join("; "));
      return;
    }

    setFormError(null);
    await onSave(payload);
    closeForm();
  }

  async function handleArchive(identityId: string) {
    setArchivingId(identityId);
    try {
      await onArchive(identityId);
      if (editingIdentity?.id === identityId) closeForm();
    } finally {
      setArchivingId(null);
    }
  }

  const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm w-full";
  const showForm = formMode !== null && !readOnly;

  return (
    <div className="space-y-4">
      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={openCreate}
            disabled={showForm || availableBoards.length === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add Exam Board Identity
          </button>
          {availableBoards.length === 0 && identities.length > 0 ? (
            <p className="text-sm text-slate-500">All configured exam boards already have an identity.</p>
          ) : null}
        </div>
      ) : null}

      {identities.length === 0 ? (
        <p className="text-sm text-slate-500">No Exam Board Identity has been created.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Exam Board</th>
                <th className="py-2 pr-3">Centre Number</th>
                <th className="py-2 pr-3">Candidate Number</th>
                <th className="py-2 pr-3">UCI Number</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Registered At</th>
                <th className="py-2 pr-3">Notes</th>
                {!readOnly ? <th className="py-2 pr-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {identities.map((identity) => (
                <tr key={identity.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium">{identity.examBoard.name}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{identity.centreNumber ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{identity.candidateNumber ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{identity.uciNumber ?? "—"}</td>
                  <td className="py-2 pr-3">{candidateExamIdentityStatusLabel(identity.status)}</td>
                  <td className="py-2 pr-3">{formatRegisteredAt(identity.registeredAt)}</td>
                  <td className="max-w-[14rem] truncate py-2 pr-3" title={identity.notes ?? undefined}>
                    {identity.notes ?? "—"}
                  </td>
                  {!readOnly ? (
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(identity)}
                          className="text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                        {identity.status !== "ARCHIVED" ? (
                          <button
                            type="button"
                            disabled={archivingId === identity.id || saving}
                            onClick={() => void handleArchive(identity.id)}
                            className="text-slate-700 hover:underline disabled:opacity-50"
                          >
                            {archivingId === identity.id ? "Archiving..." : "Archive"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-slate-900">
              {formMode === "edit"
                ? `Edit ${editingIdentity?.examBoard.name ?? "exam board"} identity`
                : "Add Exam Board Identity"}
            </h3>
            <button type="button" onClick={closeForm} className="text-sm text-slate-600 hover:underline">
              Cancel
            </button>
          </div>

          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Exam Board *</span>
              <select
                required
                disabled={formMode === "edit"}
                value={form.examBoardId}
                onChange={(e) => {
                  const nextBoard = examBoards.find((board) => board.id === e.target.value);
                  const nextRules = nextBoard
                    ? examBoardIdentityRules(nextBoard.code, nextBoard.name)
                    : null;
                  setForm((prev) => ({
                    ...prev,
                    examBoardId: e.target.value,
                    uciNumber: nextRules?.uciNumberAllowed ? prev.uciNumber : "",
                  }));
                  setFormError(null);
                }}
                className={inputClass}
              >
                <option value="">Select exam board</option>
                {availableBoards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">
                Centre Number{boardRules.centreNumberRequired ? " *" : ""}
              </span>
              <input
                required={boardRules.centreNumberRequired}
                value={form.centreNumber}
                onChange={(e) => setForm({ ...form, centreNumber: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">
                Candidate Number{boardRules.candidateNumberRequired ? " *" : ""}
              </span>
              <input
                required={boardRules.candidateNumberRequired}
                value={form.candidateNumber}
                onChange={(e) => setForm({ ...form, candidateNumber: e.target.value })}
                className={inputClass}
              />
            </label>
            {boardRules.uciNumberAllowed ? (
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">UCI Number</span>
                <input
                  value={form.uciNumber}
                  onChange={(e) => setForm({ ...form, uciNumber: e.target.value })}
                  className={inputClass}
                />
              </label>
            ) : null}
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Status</span>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as CandidateExamIdentityStatus })
                }
                className={inputClass}
              >
                {CANDIDATE_EXAM_IDENTITY_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving || !form.examBoardId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : formMode === "edit" ? "Save changes" : "Add identity"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
