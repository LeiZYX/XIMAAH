"use client";

import { useState } from "react";
import { LateRegistrationModal } from "@/components/registrations/LateRegistrationModal";

export function HelpStudentRegisterButton({
  apiPath,
  detailBasePath,
}: {
  apiPath: string;
  detailBasePath: string;
}) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [workspaceLink, setWorkspaceLink] = useState<string | null>(null);

  function handleSubmitted(result: { workspaceId?: string }) {
    setSuccess("Late registration created successfully. The student can now view and print their confirmation.");
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
              </a>{" "}
              to print confirmation.
            </>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Help Student Register
      </button>
      {open ? (
        <LateRegistrationModal
          title="Help Student Register After Deadline"
          submitLabel="Create Late Registration"
          apiPath={apiPath}
          onClose={() => setOpen(false)}
          onSubmitted={handleSubmitted}
        />
      ) : null}
    </>
  );
}
