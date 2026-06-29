"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { STAGE_CODE_OPTIONS, entryTypeLabel } from "@/lib/registrations/stage-labels";
import { DEFAULT_STAGE_TEMPLATES } from "@/lib/registrations/stages";

interface StageRow {
  id?: string;
  stageCode: "NORMAL" | "LATE" | "HIGH_LATE";
  stageName: string;
  sequence: number;
  startAt: string;
  endAt: string;
  enabled: boolean;
  notes: string;
}

interface RegistrationStagesPanelProps {
  windowId: string;
  canEdit?: boolean;
}

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStageRow(
  template: (typeof DEFAULT_STAGE_TEMPLATES)[number],
  windowStart: string,
  windowEnd: string,
): StageRow {
  return {
    stageCode: template.stageCode,
    stageName: template.stageName,
    sequence: template.sequence,
    startAt: windowStart ? toLocalInput(windowStart) : "",
    endAt: windowEnd ? toLocalInput(windowEnd) : "",
    enabled: template.stageCode === "NORMAL",
    notes: "",
  };
}

export function RegistrationStagesPanel({
  windowId,
  canEdit = true,
}: RegistrationStagesPanelProps) {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [stagesRes, windowRes] = await Promise.all([
      fetch(`/api/registration-windows/${windowId}/stages`),
      fetch(`/api/registration-windows/${windowId}`),
    ]);

    const windowData = windowRes.ok ? await windowRes.json() : null;
    const existing: StageRow[] = stagesRes.ok ? await stagesRes.json() : [];

    if (existing.length > 0) {
      setStages(
        existing.map((s: StageRow & { startAt: string; endAt: string; notes?: string | null }) => ({
          id: s.id,
          stageCode: s.stageCode,
          stageName: s.stageName,
          sequence: s.sequence,
          startAt: toLocalInput(s.startAt),
          endAt: toLocalInput(s.endAt),
          enabled: s.enabled,
          notes: s.notes ?? "",
        })),
      );
    } else if (windowData) {
      setStages(
        DEFAULT_STAGE_TEMPLATES.map((t) =>
          defaultStageRow(t, windowData.startAt, windowData.endAt),
        ),
      );
    }

    setLoading(false);
  }, [windowId]);

  useEffect(() => {
    load();
  }, [load]);

  function updateStage(index: number, patch: Partial<StageRow>) {
    setStages((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch(`/api/registration-windows/${windowId}/stages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stages: stages.map((s) => ({
          id: s.id,
          stageCode: s.stageCode,
          stageName: s.stageName,
          sequence: s.sequence,
          startAt: new Date(s.startAt).toISOString(),
          endAt: new Date(s.endAt).toISOString(),
          enabled: s.enabled,
          notes: s.notes.trim() || null,
        })),
      }),
    });

    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      setStages(
        saved.map((s: StageRow & { startAt: string; endAt: string; notes?: string | null }) => ({
          id: s.id,
          stageCode: s.stageCode,
          stageName: s.stageName,
          sequence: s.sequence,
          startAt: toLocalInput(s.startAt),
          endAt: toLocalInput(s.endAt),
          enabled: s.enabled,
          notes: s.notes ?? "",
        })),
      );
      setMessage("Registration stages saved.");
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to save registration stages.");
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Loading registration stages…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Registration stages</h2>
        <p className="mb-4 text-sm text-slate-600">
          Configure Normal Entry, Late Entry, and High Late Entry periods for this window. The system
          automatically assigns the entry stage when students or staff create registrations.
        </p>

        <form onSubmit={handleSave} className="space-y-6">
          {stages.map((stage, index) => (
            <fieldset
              key={stage.stageCode}
              className="rounded-lg border border-slate-200 p-4"
            >
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
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Start date and time</span>
                  <input
                    required
                    type="datetime-local"
                    disabled={!canEdit}
                    value={stage.startAt}
                    onChange={(e) => updateStage(index, { startAt: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">End date and time</span>
                  <input
                    required
                    type="datetime-local"
                    disabled={!canEdit}
                    value={stage.endAt}
                    onChange={(e) => updateStage(index, { endAt: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Sequence order</span>
                  <input
                    required
                    type="number"
                    min={1}
                    max={3}
                    disabled={!canEdit}
                    value={stage.sequence}
                    onChange={(e) => updateStage(index, { sequence: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
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
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-slate-600">Notes (optional)</span>
                  <textarea
                    rows={2}
                    disabled={!canEdit}
                    value={stage.notes}
                    onChange={(e) => updateStage(index, { notes: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                </label>
              </div>
            </fieldset>
          ))}

          {canEdit ? (
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save registration stages"}
            </button>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
