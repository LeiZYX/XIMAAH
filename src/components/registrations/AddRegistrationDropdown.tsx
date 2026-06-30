"use client";

import { useState } from "react";
import { PostLockAdjustmentPickerModal } from "@/components/registrations/PostLockAdjustmentPickerModal";
import { StaffRegistrationModal } from "@/components/registrations/StaffRegistrationModal";
import { ExternalCandidateRegistrationModal } from "@/components/registrations/ExternalCandidateRegistrationModal";

type ModalMode = "assisted" | "office-only-internal" | "external" | "post-lock" | null;

export function AddRegistrationDropdown({
  assistedApiPath,
  officeOnlyApiPath,
  externalApiPath,
  workspacesApiPath,
  detailBasePath,
}: {
  assistedApiPath: string;
  officeOnlyApiPath: string;
  externalApiPath: string;
  workspacesApiPath: string;
  detailBasePath: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [workspaceLink, setWorkspaceLink] = useState<string | null>(null);

  function handleSubmitted(result: { workspaceId?: string }) {
    setSuccess("Registration saved successfully.");
    if (result.workspaceId) {
      setWorkspaceLink(`${detailBasePath}/${result.workspaceId}`);
    }
  }

  return (
    <>
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
          {workspaceLink ? (
            <>
              {" "}
              <a href={workspaceLink} className="font-medium underline">
                Open registration detail
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add Registration
          <span aria-hidden>▾</span>
        </button>
        {open ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 z-50 mt-2 w-96 origin-top-right rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  setMode("assisted");
                }}
              >
                Register on behalf of internal student
                <span className="mt-0.5 block text-xs text-slate-500">
                  Student-visible registration. Same as student self-registration, created by Exams Office.
                </span>
              </button>
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  setMode("office-only-internal");
                }}
              >
                Restricted registration for internal student
                <span className="mt-0.5 block text-xs text-slate-500">
                  Office-only internal registration. Hidden from student and teachers. Billed separately.
                </span>
              </button>
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  setMode("external");
                }}
              >
                Register external candidate
                <span className="mt-0.5 block text-xs text-slate-500">
                  External candidate registration. No student portal access. Billed separately.
                </span>
              </button>
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  setMode("post-lock");
                }}
              >
                Adjust locked registration
                <span className="mt-0.5 block text-xs text-slate-500">
                  Modify an existing locked normal/internal registration. Changes remain merged with the original
                  student-visible registration.
                </span>
              </button>
            </div>
          </>
        ) : null}
      </div>

      {mode === "assisted" ? (
        <StaffRegistrationModal
          mode="assisted"
          title="Register on behalf of internal student"
          submitLabel="Create assisted registration"
          apiPath={assistedApiPath}
          candidateType="INTERNAL"
          onClose={() => setMode(null)}
          onSubmitted={handleSubmitted}
        />
      ) : null}

      {mode === "office-only-internal" ? (
        <StaffRegistrationModal
          mode="office-only"
          title="Restricted registration for internal student"
          submitLabel="Create restricted registration"
          apiPath={officeOnlyApiPath}
          candidateType="INTERNAL"
          onClose={() => setMode(null)}
          onSubmitted={handleSubmitted}
        />
      ) : null}

      {mode === "external" ? (
        <ExternalCandidateRegistrationModal
          apiPath={externalApiPath}
          onClose={() => setMode(null)}
          onSubmitted={handleSubmitted}
        />
      ) : null}

      {mode === "post-lock" ? (
        <PostLockAdjustmentPickerModal
          workspacesApiPath={workspacesApiPath}
          detailBasePath={detailBasePath}
          onClose={() => setMode(null)}
        />
      ) : null}
    </>
  );
}
