"use client";

import { FormEvent, useEffect, useState } from "react";
import { ReviewWindowDetailShell } from "@/components/review-windows/ReviewWindowDetailShell";
import {
  CONFIGURABLE_REVIEW_SERVICES,
  postResultServiceLabel,
} from "@/lib/post-results/constants";
import type { PostResultServiceType } from "@/generated/prisma";

interface ServiceRow {
  id: string;
  serviceType: PostResultServiceType;
  enabled: boolean;
  notes: string | null;
}

interface ReviewWindowServicesProps {
  windowId: string;
  basePath: "/admin/review-windows" | "/exam-office/review-windows";
  feeStatementsBasePath: "/admin/fee-statements" | "/exam-office/fee-statements";
}

export function ReviewWindowServices({
  windowId,
  basePath,
  feeStatementsBasePath,
}: ReviewWindowServicesProps) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadServices() {
    setLoading(true);
    const response = await fetch(`/api/review-windows/${windowId}/services`);
    if (response.ok) {
      const rows: ServiceRow[] = await response.json();
      setServices(
        rows.filter((row) => CONFIGURABLE_REVIEW_SERVICES.includes(row.serviceType)),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadServices();
  }, [windowId]);

  function toggleService(serviceType: PostResultServiceType) {
    setServices((current) =>
      current.map((row) =>
        row.serviceType === serviceType ? { ...row, enabled: !row.enabled } : row,
      ),
    );
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/review-windows/${windowId}/services`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to save services");
      }

      setServices(await response.json());
      setMessage("Available services updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReviewWindowDetailShell
      windowId={windowId}
      basePath={basePath}
      feeStatementsBasePath={feeStatementsBasePath}
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="max-w-2xl space-y-4 border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">
            Enable or disable post-results services for this review window. Registration window
            services are not managed here.
          </p>
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </p>
          ) : null}
          <div className="divide-y divide-slate-100 border border-slate-200">
            {services.map((service) => (
              <label
                key={service.serviceType}
                className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <span className="text-sm font-medium text-slate-900">
                  {postResultServiceLabel(service.serviceType)}
                </span>
                <input
                  type="checkbox"
                  checked={service.enabled}
                  onChange={() => toggleService(service.serviceType)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save services"}
          </button>
        </form>
      )}
    </ReviewWindowDetailShell>
  );
}
