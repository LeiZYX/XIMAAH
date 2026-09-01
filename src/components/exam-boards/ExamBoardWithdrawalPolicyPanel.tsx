"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY,
  effectiveWithdrawalRefundPercent,
  type ExamBoardWithdrawalPolicyInput,
} from "@/lib/fees/withdrawal-policy";

type PolicyForm = ExamBoardWithdrawalPolicyInput;

function StageRefundFields({
  label,
  enabled,
  percent,
  paymentFeePercent,
  onEnabledChange,
  onPercentChange,
  disabled,
}: {
  label: string;
  enabled: boolean;
  percent: number;
  paymentFeePercent: number;
  onEnabledChange: (value: boolean) => void;
  onPercentChange: (value: number) => void;
  disabled?: boolean;
}) {
  const effective = effectiveWithdrawalRefundPercent({
    refundEnabled: enabled,
    configuredPercent: percent,
    paymentFeePercent,
  });

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-900">{label}</p>
      <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="rounded border-slate-300"
        />
        Allow refund on remove
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Configured refund %</span>
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          disabled={disabled || !enabled}
          value={percent}
          onChange={(event) => onPercentChange(Number(event.target.value))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        />
      </label>
      <p className="mt-2 text-xs text-slate-500">
        Effective refund: <span className="font-medium text-slate-700">{effective}%</span>
        {" "}(min of configured % and 100% − payment fee)
      </p>
    </div>
  );
}

export function ExamBoardWithdrawalPolicyPanel({
  examBoardId,
  examBoardLabel,
  canEdit = true,
}: {
  examBoardId: string;
  examBoardLabel: string;
  canEdit?: boolean;
}) {
  const [form, setForm] = useState<PolicyForm>(DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/exam-boards/${examBoardId}/withdrawal-policy`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to load withdrawal policy");
      setLoading(false);
      return;
    }
    const data = await response.json();
    setForm({
      paymentFeePercent: Number(data.policy.paymentFeePercent),
      refundBasis: "SALES_AMOUNT",
      normalRefundEnabled: Boolean(data.policy.normalRefundEnabled),
      normalRefundPercent: Number(data.policy.normalRefundPercent),
      lateRefundEnabled: Boolean(data.policy.lateRefundEnabled),
      lateRefundPercent: Number(data.policy.lateRefundPercent),
      highLateRefundEnabled: Boolean(data.policy.highLateRefundEnabled),
      highLateRefundPercent: Number(data.policy.highLateRefundPercent),
      notes: data.policy.notes ?? null,
    });
    setLoading(false);
  }, [examBoardId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/exam-boards/${examBoardId}/withdrawal-policy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to save withdrawal policy");
      return;
    }

    const data = await response.json();
    setForm({
      paymentFeePercent: Number(data.policy.paymentFeePercent),
      refundBasis: "SALES_AMOUNT",
      normalRefundEnabled: Boolean(data.policy.normalRefundEnabled),
      normalRefundPercent: Number(data.policy.normalRefundPercent),
      lateRefundEnabled: Boolean(data.policy.lateRefundEnabled),
      lateRefundPercent: Number(data.policy.lateRefundPercent),
      highLateRefundEnabled: Boolean(data.policy.highLateRefundEnabled),
      highLateRefundPercent: Number(data.policy.highLateRefundPercent),
      notes: data.policy.notes ?? null,
    });
    setMessage("Withdrawal policy saved. New registration windows will copy these defaults.");
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Loading withdrawal policy…</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Withdrawal refund policy</h2>
      <p className="mb-4 text-sm text-slate-600">
        Defaults for <span className="font-medium">{examBoardLabel}</span>. Refunds use the full
        sales amount. Payment fee sets a ceiling so full refund still retains platform fees.
      </p>

      {message ? <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <form onSubmit={handleSave} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Payment fee % (platform)</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            required
            disabled={!canEdit}
            value={form.paymentFeePercent}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                paymentFeePercent: Number(event.target.value),
              }))
            }
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </label>

        <div className="grid gap-3 lg:grid-cols-3">
          <StageRefundFields
            label="Normal"
            enabled={form.normalRefundEnabled}
            percent={form.normalRefundPercent}
            paymentFeePercent={form.paymentFeePercent}
            disabled={!canEdit}
            onEnabledChange={(normalRefundEnabled) =>
              setForm((current) => ({ ...current, normalRefundEnabled }))
            }
            onPercentChange={(normalRefundPercent) =>
              setForm((current) => ({ ...current, normalRefundPercent }))
            }
          />
          <StageRefundFields
            label="Late"
            enabled={form.lateRefundEnabled}
            percent={form.lateRefundPercent}
            paymentFeePercent={form.paymentFeePercent}
            disabled={!canEdit}
            onEnabledChange={(lateRefundEnabled) =>
              setForm((current) => ({ ...current, lateRefundEnabled }))
            }
            onPercentChange={(lateRefundPercent) =>
              setForm((current) => ({ ...current, lateRefundPercent }))
            }
          />
          <StageRefundFields
            label="High Late"
            enabled={form.highLateRefundEnabled}
            percent={form.highLateRefundPercent}
            paymentFeePercent={form.paymentFeePercent}
            disabled={!canEdit}
            onEnabledChange={(highLateRefundEnabled) =>
              setForm((current) => ({ ...current, highLateRefundEnabled }))
            }
            onPercentChange={(highLateRefundPercent) =>
              setForm((current) => ({ ...current, highLateRefundPercent }))
            }
          />
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Notes</span>
          <textarea
            rows={2}
            disabled={!canEdit}
            value={form.notes ?? ""}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </label>

        {canEdit ? (
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save withdrawal policy"}
          </button>
        ) : null}
      </form>
    </Card>
  );
}
