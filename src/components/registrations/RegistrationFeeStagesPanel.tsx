"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from "@/lib/datetime-local";
import { STAGE_CODE_OPTIONS, entryTypeLabel } from "@/lib/registrations/stage-labels";
import { DEFAULT_FEE_STAGE_TEMPLATES } from "@/lib/registrations/fee-stages";
import {
  applyWindowTimingToFeeStage,
  isFeeStageFieldBoundByWindow,
} from "@/lib/registrations/sync-fee-stages-from-window";
import {
  DEFAULT_PAYMENT_FEE_PERCENT,
  defaultStageWithdrawal,
  effectiveWithdrawalRefundPercent,
} from "@/lib/fees/withdrawal-policy";

interface StageRow {
  id?: string;
  stageCode: "NORMAL" | "LATE" | "HIGH_LATE";
  stageName: string;
  sequence: number;
  startAt: string;
  endAt: string;
  enabled: boolean;
  notes: string;
  withdrawalRefundEnabled: boolean;
  withdrawalRefundPercent: number;
  withdrawalNotes: string;
}

interface WindowTiming {
  studentRegistrationOpenAt: string;
  studentRegistrationCloseAt: string;
  registrationCloseAt: string;
  paymentFeePercent: number;
  examBoardId: string;
}

interface RegistrationFeeStagesPanelProps {
  windowId: string;
  canEdit?: boolean;
}

function bindStageRowToWindow(stage: StageRow, windowTiming: WindowTiming): StageRow {
  const bound = applyWindowTimingToFeeStage(
    {
      stageCode: stage.stageCode,
      startAt: stage.startAt,
      endAt: stage.endAt,
    },
    {
      studentRegistrationOpenAt: new Date(windowTiming.studentRegistrationOpenAt),
      studentRegistrationCloseAt: new Date(windowTiming.studentRegistrationCloseAt),
      registrationCloseAt: new Date(windowTiming.registrationCloseAt),
    },
  );

  return {
    ...stage,
    startAt: isoToDatetimeLocalValue(String(bound.startAt)),
    endAt: isoToDatetimeLocalValue(String(bound.endAt)),
  };
}

function defaultStageRow(
  template: (typeof DEFAULT_FEE_STAGE_TEMPLATES)[number],
  windowTiming: WindowTiming | null,
  boardPolicy?: Parameters<typeof defaultStageWithdrawal>[1],
): StageRow {
  const withdrawal = defaultStageWithdrawal(template.stageCode, boardPolicy);
  const row: StageRow = {
    stageCode: template.stageCode,
    stageName: template.stageName,
    sequence: template.sequence,
    startAt: "",
    endAt: "",
    enabled: false,
    notes: "",
    withdrawalRefundEnabled: withdrawal.withdrawalRefundEnabled,
    withdrawalRefundPercent: withdrawal.withdrawalRefundPercent,
    withdrawalNotes: withdrawal.withdrawalNotes ?? "",
  };

  return windowTiming ? bindStageRowToWindow(row, windowTiming) : row;
}

function boundFieldHint(stageCode: StageRow["stageCode"], field: "startAt" | "endAt"): string | null {
  if (stageCode === "NORMAL" && field === "startAt") {
    return "Set on Registration Window → Student registration open";
  }
  if (stageCode === "NORMAL" && field === "endAt") {
    return "Set on Registration Window → Student registration close";
  }
  if (stageCode === "HIGH_LATE" && field === "endAt") {
    return "Set on Registration Window → Registration close";
  }
  return null;
}

export function RegistrationFeeStagesPanel({
  windowId,
  canEdit = true,
}: RegistrationFeeStagesPanelProps) {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [windowTiming, setWindowTiming] = useState<WindowTiming | null>(null);
  const [paymentFeePercent, setPaymentFeePercent] = useState(DEFAULT_PAYMENT_FEE_PERCENT);
  const [boardPolicy, setBoardPolicy] = useState<Parameters<typeof defaultStageWithdrawal>[1]>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [stagesRes, windowRes] = await Promise.all([
      fetch(`/api/registration-windows/${windowId}/fee-stages`),
      fetch(`/api/registration-windows/${windowId}`),
    ]);

    const windowData = windowRes.ok ? await windowRes.json() : null;
    const timing: WindowTiming | null = windowData
      ? {
          studentRegistrationOpenAt: windowData.studentRegistrationOpenAt,
          studentRegistrationCloseAt: windowData.studentRegistrationCloseAt,
          registrationCloseAt: windowData.registrationCloseAt,
          paymentFeePercent: Number(windowData.paymentFeePercent ?? DEFAULT_PAYMENT_FEE_PERCENT),
          examBoardId: String(windowData.examBoardId ?? windowData.examBoard?.id ?? ""),
        }
      : null;
    setWindowTiming(timing);
    if (timing) setPaymentFeePercent(timing.paymentFeePercent);

    if (timing?.examBoardId) {
      const policyRes = await fetch(`/api/exam-boards/${timing.examBoardId}/withdrawal-policy`);
      if (policyRes.ok) {
        const policyData = await policyRes.json();
        setBoardPolicy({
          paymentFeePercent: Number(policyData.policy.paymentFeePercent),
          refundBasis: "SALES_AMOUNT",
          normalRefundEnabled: Boolean(policyData.policy.normalRefundEnabled),
          normalRefundPercent: Number(policyData.policy.normalRefundPercent),
          lateRefundEnabled: Boolean(policyData.policy.lateRefundEnabled),
          lateRefundPercent: Number(policyData.policy.lateRefundPercent),
          highLateRefundEnabled: Boolean(policyData.policy.highLateRefundEnabled),
          highLateRefundPercent: Number(policyData.policy.highLateRefundPercent),
          notes: policyData.policy.notes ?? null,
        });
      }
    }

    const existing: StageRow[] = stagesRes.ok ? await stagesRes.json() : [];

    if (existing.length > 0) {
      const mapped = existing.map(
        (
          s: StageRow & {
            startAt: string;
            endAt: string;
            notes?: string | null;
            withdrawalRefundEnabled?: boolean;
            withdrawalRefundPercent?: number | string;
            withdrawalNotes?: string | null;
          },
        ) => ({
          id: s.id,
          stageCode: s.stageCode,
          stageName: s.stageName,
          sequence: s.sequence,
          startAt: isoToDatetimeLocalValue(s.startAt),
          endAt: isoToDatetimeLocalValue(s.endAt),
          enabled: s.enabled,
          notes: s.notes ?? "",
          withdrawalRefundEnabled: s.withdrawalRefundEnabled ?? true,
          withdrawalRefundPercent: Number(s.withdrawalRefundPercent ?? 100),
          withdrawalNotes: s.withdrawalNotes ?? "",
        }),
      );
      setStages(timing ? mapped.map((row) => bindStageRowToWindow(row, timing)) : mapped);
    } else {
      setStages([]);
    }

    setLoading(false);
  }, [windowId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  function updateStage(index: number, patch: Partial<StageRow>) {
    setStages((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addSuggestedStages() {
    if (!windowTiming) return;
    setStages(
      DEFAULT_FEE_STAGE_TEMPLATES.map((t) => defaultStageRow(t, windowTiming, boardPolicy)),
    );
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !windowTiming) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    const payloadStages = stages.map((stage) =>
      bindStageRowToWindow(stage, windowTiming),
    );

    const res = await fetch(`/api/registration-windows/${windowId}/fee-stages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentFeePercent,
        feeStages: payloadStages.map((s) => ({
          id: s.id,
          stageCode: s.stageCode,
          stageName: s.stageName,
          sequence: s.sequence,
          startAt: datetimeLocalValueToIso(s.startAt),
          endAt: datetimeLocalValueToIso(s.endAt),
          enabled: s.enabled,
          notes: s.notes.trim() || null,
          withdrawalRefundEnabled: s.withdrawalRefundEnabled,
          withdrawalRefundPercent: s.withdrawalRefundPercent,
          withdrawalNotes: s.withdrawalNotes.trim() || null,
        })),
      }),
    });

    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      setStages(
        saved.map(
          (
            s: StageRow & {
              startAt: string;
              endAt: string;
              notes?: string | null;
              withdrawalRefundEnabled?: boolean;
              withdrawalRefundPercent?: number | string;
              withdrawalNotes?: string | null;
            },
          ) =>
            bindStageRowToWindow(
              {
                id: s.id,
                stageCode: s.stageCode,
                stageName: s.stageName,
                sequence: s.sequence,
                startAt: isoToDatetimeLocalValue(s.startAt),
                endAt: isoToDatetimeLocalValue(s.endAt),
                enabled: s.enabled,
                notes: s.notes ?? "",
                withdrawalRefundEnabled: s.withdrawalRefundEnabled ?? true,
                withdrawalRefundPercent: Number(s.withdrawalRefundPercent ?? 100),
                withdrawalNotes: s.withdrawalNotes ?? "",
              },
              windowTiming,
            ),
        ),
      );
      setMessage(
        stages.length === 0
          ? "Fee stages cleared. Normal fee rules will apply."
          : "Fee stages saved.",
      );
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to save fee stages.");
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Loading fee stages…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Fee stages</h2>
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Fee stages are optional. Normal Entry start/end and High Late Entry end follow the
          Registration Window timing on the General tab. Withdrawal refund defaults come from the
          exam board policy and can be overridden here.
        </p>

        <label className="mb-4 block max-w-xs text-sm">
          <span className="mb-1 block text-slate-600">Payment fee % (this window)</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            disabled={!canEdit}
            value={paymentFeePercent}
            onChange={(event) => setPaymentFeePercent(Number(event.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </label>

        {stages.length === 0 ? (
          <div className="mb-4 space-y-3">
            <p className="text-sm text-slate-600">No fee stages configured for this window.</p>
            {canEdit ? (
              <button
                type="button"
                onClick={addSuggestedStages}
                disabled={!windowTiming}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Normal / Late / High Late stages
              </button>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={handleSave} className="space-y-6">
          {stages.map((stage, index) => {
            const effective = effectiveWithdrawalRefundPercent({
              refundEnabled: stage.withdrawalRefundEnabled,
              configuredPercent: stage.withdrawalRefundPercent,
              paymentFeePercent,
            });
            return (
              <fieldset key={stage.stageCode} className="rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-900">
                  {entryTypeLabel(stage.stageCode)}
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">Stage name</span>
                    <input
                      required
                      disabled={!canEdit}
                      value={stage.stageName}
                      onChange={(e) => updateStage(index, { stageName: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">Stage code</span>
                    <select
                      disabled
                      value={stage.stageCode}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                    >
                      {STAGE_CODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(["startAt", "endAt"] as const).map((field) => {
                    const bound = isFeeStageFieldBoundByWindow(stage.stageCode, field);
                    const hint = boundFieldHint(stage.stageCode, field);
                    return (
                      <label key={field} className="text-sm">
                        <span className="mb-1 block text-slate-600">
                          {field === "startAt" ? "Start date and time" : "End date and time"}
                          {hint ? (
                            <span className="ml-1 block font-normal text-slate-400">{hint}</span>
                          ) : null}
                        </span>
                        <input
                          required
                          type="datetime-local"
                          disabled={!canEdit || bound}
                          value={stage[field]}
                          onChange={(e) => updateStage(index, { [field]: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </label>
                    );
                  })}
                  <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={stage.enabled}
                      onChange={(e) => updateStage(index, { enabled: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    Enabled
                  </label>
                </div>

                <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={stage.withdrawalRefundEnabled}
                      onChange={(e) =>
                        updateStage(index, { withdrawalRefundEnabled: e.target.checked })
                      }
                      className="rounded border-slate-300"
                    />
                    Allow refund on remove
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">Configured refund %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      disabled={!canEdit || !stage.withdrawalRefundEnabled}
                      value={stage.withdrawalRefundPercent}
                      onChange={(e) =>
                        updateStage(index, {
                          withdrawalRefundPercent: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      Effective: {effective}% of sales amount
                    </span>
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="mb-1 block text-slate-600">Withdrawal notes</span>
                    <input
                      disabled={!canEdit}
                      value={stage.withdrawalNotes}
                      onChange={(e) => updateStage(index, { withdrawalNotes: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </label>
                </div>
              </fieldset>
            );
          })}

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || stages.length === 0}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save fee stages"}
              </button>
              {stages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setStages([])}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Clear all fee stages
                </button>
              ) : null}
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  );
}

/** @deprecated Use RegistrationFeeStagesPanel */
export const RegistrationStagesPanel = RegistrationFeeStagesPanel;
