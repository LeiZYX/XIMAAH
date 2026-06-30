"use client";

import { useEffect, useMemo, useState } from "react";
import { SalesAmountDisplay } from "@/components/fees/SalesAmountDisplay";
import {
  RegistrationItemCard,
  RegistrationItemMeta,
} from "@/components/registrations/RegistrationItemCard";
import {
  DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  type FeeStatementDisplayCurrencyOption,
} from "@/lib/fees/display-currency";
import { readJsonResponse } from "@/lib/client/fetch-json";
import { CANDIDATE_REGISTRATION_FEE_SERVICE_NAME } from "@/lib/fees/candidate-registration-fee-constants";

export interface CandidateRegistrationFeeAuditInfo {
  performedByName: string;
  performedByRole: string;
  performedAt: string;
  reason: string | null;
}

interface FeePreview {
  serviceName: string;
  examBoardName: string;
  salesGbp: number;
  salesCny: number;
  version: number;
}

export interface CandidateRegistrationFeeSectionProps {
  examBoardId: string | null;
  examBoardName: string | null;
  registrationWindowId: string | null;
  savedIncluded: boolean;
  pendingIncluded: boolean;
  onPendingIncludedChange: (value: boolean) => void;
  feeReason: string;
  onFeeReasonChange: (value: string) => void;
  savedAuditInfo?: CandidateRegistrationFeeAuditInfo | null;
  displayCurrency?: FeeStatementDisplayCurrencyOption;
  onDisplayCurrencyChange?: (value: FeeStatementDisplayCurrencyOption) => void;
  showDisplayCurrencySelector?: boolean;
  disabled?: boolean;
  onSave?: () => void;
  saving?: boolean;
  showSaveButton?: boolean;
}

function roleLabel(role: string): string {
  if (role === "EXAM_OFFICER") return "Exam Officer";
  if (role === "ADMIN") return "Admin";
  return role;
}

export function CandidateRegistrationFeeSection({
  examBoardId,
  examBoardName,
  registrationWindowId,
  savedIncluded,
  pendingIncluded,
  onPendingIncludedChange,
  feeReason,
  onFeeReasonChange,
  savedAuditInfo = null,
  displayCurrency = DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  onDisplayCurrencyChange,
  showDisplayCurrencySelector = false,
  disabled = false,
  onSave,
  saving = false,
  showSaveButton = false,
}: CandidateRegistrationFeeSectionProps) {
  const [preview, setPreview] = useState<FeePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const pendingChange = pendingIncluded !== savedIncluded;
  const pendingBadge = pendingIncluded && !savedIncluded
    ? ("Pending Add" as const)
    : !pendingIncluded && savedIncluded
      ? ("Pending Remove" as const)
      : null;

  const showAddedCard = pendingIncluded;
  const reasonRequired = pendingChange;
  const reasonLabel = pendingIncluded
    ? "Reason for adding Candidate Registration Fee"
    : "Reason for removing Candidate Registration Fee";

  useEffect(() => {
    if (!examBoardId || !registrationWindowId) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    const params = new URLSearchParams({
      examBoardId,
      registrationWindowId,
    });

    fetch(`/api/fee-schedules/candidate-registration?${params.toString()}`)
      .then((response) =>
        readJsonResponse<{ preview?: FeePreview | null; error?: string }>(response),
      )
      .then((data) => {
        if (cancelled) return;
        if (!data.preview) {
          setPreview(null);
          setPreviewError(
            "No active Fee Schedule found for Candidate Registration Fee on this exam board.",
          );
          return;
        }
        setPreview(data.preview);
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
          setPreviewError("Could not load fee schedule.");
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [examBoardId, registrationWindowId]);

  const amounts = useMemo(
    () => ({
      salesGbp: preview?.salesGbp ?? 0,
      salesCny: preview?.salesCny ?? 0,
    }),
    [preview],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Additional Services</h3>
          <p className="mt-1 text-xs text-slate-600">
            Optional fees selected by Exam Officer or Admin. Changes are saved when you click Save
            Changes.
          </p>
        </div>
        {showDisplayCurrencySelector && onDisplayCurrencyChange ? (
          <select
            value={displayCurrency}
            onChange={(event) =>
              onDisplayCurrencyChange(event.target.value as FeeStatementDisplayCurrencyOption)
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="GBP">Display GBP</option>
            <option value="CNY">Display CNY</option>
            <option value="BOTH">Display GBP + CNY</option>
          </select>
        ) : null}
      </div>

      {!showAddedCard ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4">
          <p className="text-sm font-semibold text-slate-900">{CANDIDATE_REGISTRATION_FEE_SERVICE_NAME}</p>
          <p className="mt-1 text-sm text-slate-600">
            This fee has not been added to this registration.
          </p>
          <button
            type="button"
            disabled={disabled || previewLoading || Boolean(previewError)}
            onClick={() => onPendingIncludedChange(true)}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Add Candidate Registration Fee
          </button>
          {previewError ? <p className="mt-3 text-sm text-amber-800">{previewError}</p> : null}
        </div>
      ) : (
        <RegistrationItemCard
          title={CANDIDATE_REGISTRATION_FEE_SERVICE_NAME}
          badge={pendingBadge}
          muted={pendingBadge === "Pending Remove"}
          action={
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPendingIncludedChange(false)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <RegistrationItemMeta
              label="Exam board"
              value={preview?.examBoardName ?? examBoardName ?? "—"}
            />
            <RegistrationItemMeta
              label="Fee schedule"
              value={preview ? `v${preview.version}` : previewLoading ? "Loading…" : "—"}
            />
            <SalesAmountDisplay
              amounts={amounts}
              displayCurrency={displayCurrency}
              className="sm:col-span-2"
            />
            {savedIncluded && savedAuditInfo ? (
              <>
                <RegistrationItemMeta
                  label="Added by"
                  value={`${savedAuditInfo.performedByName} (${roleLabel(savedAuditInfo.performedByRole)})`}
                />
                <RegistrationItemMeta
                  label="Added at"
                  value={new Date(savedAuditInfo.performedAt).toLocaleString()}
                />
                {savedAuditInfo.reason ? (
                  <RegistrationItemMeta
                    label="Reason"
                    value={savedAuditInfo.reason}
                  />
                ) : null}
              </>
            ) : null}
          </div>
          {previewError ? <p className="text-sm text-amber-800">{previewError}</p> : null}
        </RegistrationItemCard>
      )}

      {reasonRequired ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            {reasonLabel} <span className="text-red-600">*</span>
          </span>
          <textarea
            value={feeReason}
            onChange={(event) => onFeeReasonChange(event.target.value)}
            rows={2}
            disabled={disabled}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Required for audit log"
          />
        </label>
      ) : null}

      {showSaveButton && pendingChange && onSave ? (
        <button
          type="button"
          disabled={disabled || saving || (reasonRequired && !feeReason.trim())}
          onClick={onSave}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      ) : null}
    </div>
  );
}

/** @deprecated Use CandidateRegistrationFeeSection */
export const AdditionalServicesSection = CandidateRegistrationFeeSection;
