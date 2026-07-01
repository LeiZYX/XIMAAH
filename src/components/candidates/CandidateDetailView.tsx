"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CandidateLifecycleActions } from "@/components/candidates/CandidateLifecycleActions";
import { SetPasswordModal } from "@/components/users/SetPasswordModal";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  computeDisplayName,
  formatDateOfBirth,
  genderLabel,
  GENDER_OPTIONS,
  idDocumentTypeLabel,
  ID_DOCUMENT_TYPE_OPTIONS,
} from "@/lib/candidates/identity";
import { candidateStatusLabel, candidateTypeLabel } from "@/lib/candidates/labels";
import type { Gender, IdDocumentType } from "@/generated/prisma/enums";

type CandidateRecord = Record<string, unknown>;

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span className="text-slate-500">{label}</span>
      <p className="font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-lg font-semibold text-slate-900">{children}</h2>;
}

export function CandidateDetailView({
  candidateId,
  apiPath,
  backHref,
  readOnly = false,
}: {
  candidateId: string;
  apiPath: string;
  backHref: string;
  readOnly?: boolean;
}) {
  const [candidate, setCandidate] = useState<CandidateRecord | null>(null);
  const [examBoards, setExamBoards] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [identityForm, setIdentityForm] = useState({
    chineseName: "",
    surnamePinyin: "",
    givenNamePinyin: "",
    preferredEnglishName: "",
    legalEnglishName: "",
    gender: "" as Gender | "",
    dateOfBirth: "",
    nationality: "",
    idDocumentType: "" as IdDocumentType | "",
    idDocumentNumber: "",
    email: "",
    phone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    studentNumber: "",
    grade: "",
    className: "",
    graduationYear: "",
    assessmentHubCandidateNumber: "",
    status: "ACTIVE",
  });
  const [examIdentityForm, setExamIdentityForm] = useState({
    examBoardId: "",
    centreNumber: "",
    boardCandidateNumber: "",
    uci: "",
    notes: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [setPasswordOpen, setSetPasswordOpen] = useState(false);
  const router = useRouter();

  async function load() {
    const response = await fetch(`${apiPath}/${candidateId}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to load candidate");
      return;
    }
    setCandidate(data);
    setIdentityForm({
      chineseName: String(data.chineseName ?? ""),
      surnamePinyin: String(data.surnamePinyin ?? ""),
      givenNamePinyin: String(data.givenNamePinyin ?? ""),
      preferredEnglishName: String(data.preferredEnglishName ?? ""),
      legalEnglishName: String(data.legalEnglishName ?? data.englishName ?? ""),
      gender: (data.gender as Gender) ?? "",
      dateOfBirth:
        data.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : "",
      nationality: String(data.nationality ?? ""),
      idDocumentType: (data.idDocumentType as IdDocumentType) ?? "",
      idDocumentNumber: String(
        data.idDocumentNumber ?? data.idNumber ?? data.passportNumber ?? "",
      ),
      email: String(data.email ?? ""),
      phone: String(data.phone ?? ""),
      emergencyContactName: String(data.emergencyContactName ?? ""),
      emergencyContactPhone: String(data.emergencyContactPhone ?? ""),
      studentNumber: String(data.studentNumber ?? ""),
      grade: String(data.grade ?? ""),
      className: String(data.className ?? ""),
      graduationYear: data.graduationYear ? String(data.graduationYear) : "",
      assessmentHubCandidateNumber: String(data.assessmentHubCandidateNumber ?? ""),
      status: String(data.status ?? "ACTIVE"),
    });
  }

  useEffect(() => {
    void load();
    fetch("/api/exam-boards")
      .then((r) => r.json())
      .then((data) => setExamBoards(Array.isArray(data) ? data : []))
      .catch(() => setExamBoards([]));
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUserRole(data?.user?.role ?? null))
      .catch(() => setUserRole(null));
  }, [apiPath, candidateId]);

  const displayName = useMemo(
    () =>
      candidate
        ? computeDisplayName({
            preferredEnglishName: String(candidate.preferredEnglishName ?? ""),
            legalEnglishName: String(candidate.legalEnglishName ?? candidate.englishName ?? ""),
            englishName: String(candidate.englishName ?? ""),
          })
        : "",
    [candidate],
  );

  const isInternal = candidate?.candidateType === "INTERNAL";
  const photoUrl = typeof candidate?.photoUrl === "string" ? candidate.photoUrl : null;
  const linkedUser = candidate?.user as { id: string; email: string | null; isActive: boolean } | null | undefined;
  const canManageLifecycle = userRole === "ADMIN" || userRole === "EXAM_OFFICER";
  const canDelete = userRole === "ADMIN";
  const canSetPassword = userRole === "ADMIN" && Boolean(linkedUser?.id);

  async function saveIdentity(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`${apiPath}/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: {
          ...identityForm,
          gender: identityForm.gender || null,
          idDocumentType: identityForm.idDocumentType || null,
          graduationYear: identityForm.graduationYear
            ? Number(identityForm.graduationYear)
            : null,
        },
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save candidate");
      return;
    }
    setMessage("Candidate profile saved.");
    setCandidate(data);
  }

  async function saveExamIdentity() {
    if (readOnly || !examIdentityForm.examBoardId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`${apiPath}/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examIdentity: examIdentityForm }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save exam identity");
      return;
    }
    setMessage("Exam board identity saved.");
    setCandidate(data);
  }

  async function uploadPhoto(file: File) {
    if (readOnly) return;
    setPhotoUploading(true);
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.append("photo", file);
    const response = await fetch(`${apiPath}/${candidateId}/photo`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    setPhotoUploading(false);
    if (!response.ok) {
      setError(data.error ?? "Photo upload failed");
      return;
    }
    setMessage("Photo uploaded.");
    setCandidate(data);
  }

  async function removePhoto() {
    if (readOnly) return;
    setPhotoUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("action", "remove");
    const response = await fetch(`${apiPath}/${candidateId}/photo`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    setPhotoUploading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not remove photo");
      return;
    }
    setMessage("Photo removed.");
    setCandidate(data);
  }

  async function submitForceSetPassword(password: string, confirmPassword: string) {
    if (!linkedUser?.id) return "No linked user account";
    const response = await fetch(`/api/admin/users/${linkedUser.id}/force-set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirmPassword }),
    });
    const data = await response.json();
    if (!response.ok) {
      return typeof data.error === "string" ? data.error : "Could not set password";
    }
    setMessage(typeof data.message === "string" ? data.message : "Password has been updated successfully.");
    return null;
  }

  if (!candidate) {
    return <p className="text-sm text-slate-500">{error ?? "Loading candidate..."}</p>;
  }

  const identities = (candidate.examIdentities as Array<Record<string, unknown>>) ?? [];
  const workspaces = (candidate.registrationWorkspaces as Array<Record<string, unknown>>) ?? [];
  const feeStatements = (candidate.feeStatements as Array<Record<string, unknown>>) ?? [];

  const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm w-full";

  return (
    <div className="space-y-6">
      <PageHeader
        title={displayName || String(candidate.englishName)}
        description={`Student ID ${String(candidate.studentId ?? "—")}`}
      />
      <p className="text-sm">
        <Link href={backHref} className="text-indigo-600 hover:underline">
          Back to candidates
        </Link>
      </p>

      {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <Card className="space-y-4">
        <SectionTitle>Student Overview</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Student ID" value={String(candidate.studentId ?? "—")} />
          <Field label="Candidate Number" value={String(candidate.assessmentHubCandidateNumber ?? "—")} />
          <Field label="Chinese Name" value={String(candidate.chineseName ?? "—")} />
          <Field label="English Name" value={String(candidate.englishName ?? "—")} />
          <Field label="Grade" value={String(candidate.grade ?? "—")} />
          <Field label="Class" value={String(candidate.className ?? "—")} />
          <Field label="Status" value={candidateStatusLabel(candidate.status as never)} />
          <div>
            <span className="text-slate-500">User Account</span>
            <p className="font-medium text-slate-900">
              {linkedUser
                ? `${linkedUser.email ?? linkedUser.id} (${linkedUser.isActive ? "Active" : "Inactive"})`
                : "—"}
            </p>
            {canSetPassword ? (
              <button
                type="button"
                onClick={() => setSetPasswordOpen(true)}
                className="mt-1 text-sm text-indigo-600 hover:underline"
              >
                Set password
              </button>
            ) : null}
          </div>
        </div>
        {!readOnly && (canManageLifecycle || canDelete) ? (
          <CandidateLifecycleActions
            candidateId={candidateId}
            apiPath={apiPath}
            status={String(candidate.status ?? "ACTIVE")}
            canArchive={canManageLifecycle}
            canDelete={canDelete}
            onChanged={() => void load()}
            onDeleted={() => router.push(backHref)}
          />
        ) : null}
      </Card>

      <SetPasswordModal
        open={setPasswordOpen}
        userLabel={displayName || String(candidate.englishName)}
        onClose={() => setSetPasswordOpen(false)}
        onSubmit={submitForceSetPassword}
      />

      <Card className="space-y-4">
        <SectionTitle>Profile Photo</SectionTitle>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-40 w-[120px] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {photoUrl ? (
              <img src={photoUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-slate-400">No photo</span>
            )}
          </div>
          {!readOnly ? (
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white">
                {photoUploading ? "Uploading..." : "Upload photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  disabled={photoUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadPhoto(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {photoUrl ? (
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={() => void removePhoto()}
                  className="block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
                >
                  Remove photo
                </button>
              ) : null}
              <p className="text-xs text-slate-500">JPG or PNG, max 2MB. Recommended 300×400 px (3:4).</p>
            </div>
          ) : null}
        </div>
      </Card>

      <form onSubmit={saveIdentity} className="space-y-6">
        <Card className="space-y-4">
          <SectionTitle>Identity Information</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Chinese Name *</span>
              <input required disabled={readOnly} value={identityForm.chineseName} onChange={(e) => setIdentityForm({ ...identityForm, chineseName: e.target.value })} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Surname (Pinyin) *</span>
              <input required disabled={readOnly} value={identityForm.surnamePinyin} onChange={(e) => setIdentityForm({ ...identityForm, surnamePinyin: e.target.value.toUpperCase() })} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Given Name (Pinyin) *</span>
              <input required disabled={readOnly} value={identityForm.givenNamePinyin} onChange={(e) => setIdentityForm({ ...identityForm, givenNamePinyin: e.target.value.toUpperCase() })} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Preferred English Name</span>
              <input disabled={readOnly} value={identityForm.preferredEnglishName} onChange={(e) => setIdentityForm({ ...identityForm, preferredEnglishName: e.target.value })} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Legal English Name *</span>
              <input required disabled={readOnly} value={identityForm.legalEnglishName} onChange={(e) => setIdentityForm({ ...identityForm, legalEnglishName: e.target.value.toUpperCase() })} className={inputClass} />
            </label>
            <Field label="Display Name" value={computeDisplayName(identityForm)} />
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Gender *</span>
              <select required disabled={readOnly} value={identityForm.gender} onChange={(e) => setIdentityForm({ ...identityForm, gender: e.target.value as Gender })} className={inputClass}>
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Date of Birth *</span>
              <input required disabled={readOnly} type="date" value={identityForm.dateOfBirth} onChange={(e) => setIdentityForm({ ...identityForm, dateOfBirth: e.target.value })} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Nationality</span>
              <input disabled={readOnly} value={identityForm.nationality} onChange={(e) => setIdentityForm({ ...identityForm, nationality: e.target.value })} className={inputClass} />
            </label>
          </div>
        </Card>

        <Card className="space-y-4">
          <SectionTitle>Identity Document</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Document Type *</span>
              <select required disabled={readOnly} value={identityForm.idDocumentType} onChange={(e) => setIdentityForm({ ...identityForm, idDocumentType: e.target.value as IdDocumentType })} className={inputClass}>
                <option value="">Select document type</option>
                {ID_DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">ID / Passport Number *</span>
              <input required disabled={readOnly} value={identityForm.idDocumentNumber} onChange={(e) => setIdentityForm({ ...identityForm, idDocumentNumber: e.target.value })} className={inputClass} />
            </label>
          </div>
        </Card>

        <Card className="space-y-4">
          <SectionTitle>Candidate Information</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Candidate Type" value={candidateTypeLabel(candidate.candidateType as never)} />
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">AH Candidate Number *</span>
              <input required disabled={readOnly} value={identityForm.assessmentHubCandidateNumber} onChange={(e) => setIdentityForm({ ...identityForm, assessmentHubCandidateNumber: e.target.value })} className={inputClass} />
            </label>
            <Field label="Status" value={candidateStatusLabel(candidate.status as never)} />
          </div>
        </Card>

        {isInternal ? (
          <Card className="space-y-4">
            <SectionTitle>School Information</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Student Number</span>
                <input disabled={readOnly} value={identityForm.studentNumber} onChange={(e) => setIdentityForm({ ...identityForm, studentNumber: e.target.value })} className={inputClass} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Grade</span>
                <input disabled={readOnly} value={identityForm.grade} onChange={(e) => setIdentityForm({ ...identityForm, grade: e.target.value })} className={inputClass} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Class</span>
                <input disabled={readOnly} value={identityForm.className} onChange={(e) => setIdentityForm({ ...identityForm, className: e.target.value })} className={inputClass} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Graduation Year</span>
                <input disabled={readOnly} type="number" value={identityForm.graduationYear} onChange={(e) => setIdentityForm({ ...identityForm, graduationYear: e.target.value })} className={inputClass} />
              </label>
            </div>
          </Card>
        ) : null}

        <Card className="space-y-4">
          <SectionTitle>Contact</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Email</span>
              <input disabled={readOnly} type="email" value={identityForm.email} onChange={(e) => setIdentityForm({ ...identityForm, email: e.target.value })} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Phone</span>
              <input disabled={readOnly} value={identityForm.phone} onChange={(e) => setIdentityForm({ ...identityForm, phone: e.target.value })} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Emergency Contact</span>
              <input disabled={readOnly} value={identityForm.emergencyContactName} onChange={(e) => setIdentityForm({ ...identityForm, emergencyContactName: e.target.value })} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Emergency Contact Phone</span>
              <input disabled={readOnly} value={identityForm.emergencyContactPhone} onChange={(e) => setIdentityForm({ ...identityForm, emergencyContactPhone: e.target.value })} className={inputClass} />
            </label>
          </div>
        </Card>

        {!readOnly ? (
          <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save candidate profile"}
          </button>
        ) : null}
      </form>

      <Card>
        <SectionTitle>Exam Board Identities</SectionTitle>
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
        {!readOnly ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={examIdentityForm.examBoardId} onChange={(e) => setExamIdentityForm({ ...examIdentityForm, examBoardId: e.target.value })} className={inputClass}>
                <option value="">Select exam board</option>
                {examBoards.map((board) => (
                  <option key={board.id} value={board.id}>{board.name}</option>
                ))}
              </select>
              <input placeholder="Centre number" value={examIdentityForm.centreNumber} onChange={(e) => setExamIdentityForm({ ...examIdentityForm, centreNumber: e.target.value })} className={inputClass} />
              <input placeholder="Board candidate number" value={examIdentityForm.boardCandidateNumber} onChange={(e) => setExamIdentityForm({ ...examIdentityForm, boardCandidateNumber: e.target.value })} className={inputClass} />
              <input placeholder="UCI (Pearson)" value={examIdentityForm.uci} onChange={(e) => setExamIdentityForm({ ...examIdentityForm, uci: e.target.value })} className={inputClass} />
            </div>
            <button type="button" onClick={() => void saveExamIdentity()} disabled={saving} className="mt-3 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700">
              Save exam board identity
            </button>
          </>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Registration History</SectionTitle>
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
        <SectionTitle>Fee Statements</SectionTitle>
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
