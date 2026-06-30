"use client";

import { FormEvent, useEffect, useState } from "react";
import { ReviewWindowDetailShell } from "@/components/review-windows/ReviewWindowDetailShell";
import {
  REVIEW_REQUEST_STATUS_OPTIONS,
  postResultServiceLabel,
  reviewRequestStatusLabel,
} from "@/lib/post-results/constants";
import type { PostResultServiceType } from "@/generated/prisma";

interface ReviewRequestRow {
  id: string;
  serviceType: PostResultServiceType;
  status: string;
  priority: boolean;
  createdAt: string;
  candidate?: { englishName: string; assessmentHubCandidateNumber: string };
  subject?: { name: string; code: string } | null;
}

interface CandidateOption {
  id: string;
  englishName: string;
  assessmentHubCandidateNumber: string;
}

interface ReviewWindowReviewRequestsProps {
  windowId: string;
  basePath: "/admin/review-windows" | "/exam-office/review-windows";
  feeStatementsBasePath: "/admin/fee-statements" | "/exam-office/fee-statements";
}

export function ReviewWindowReviewRequests({
  windowId,
  basePath,
  feeStatementsBasePath,
}: ReviewWindowReviewRequestsProps) {
  const [requests, setRequests] = useState<ReviewRequestRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [enabledServices, setEnabledServices] = useState<PostResultServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterCandidateId, setFilterCandidateId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterServiceType, setFilterServiceType] = useState("");

  const [candidateId, setCandidateId] = useState("");
  const [serviceType, setServiceType] = useState<PostResultServiceType>("REVIEW");
  const [priority, setPriority] = useState(false);
  const [notes, setNotes] = useState("");

  async function loadRequests() {
    const params = new URLSearchParams();
    if (filterCandidateId) params.set("candidateId", filterCandidateId);
    if (filterStatus) params.set("status", filterStatus);
    if (filterServiceType) params.set("serviceType", filterServiceType);

    const response = await fetch(
      `/api/review-windows/${windowId}/review-requests?${params.toString()}`,
    );
    if (response.ok) setRequests(await response.json());
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([
        loadRequests(),
        fetch("/api/candidates/search")
          .then((r) => (r.ok ? r.json() : []))
          .then((data) => setCandidates(Array.isArray(data) ? data : [])),
        fetch(`/api/review-windows/${windowId}/services`)
          .then((r) => (r.ok ? r.json() : []))
          .then((rows: { serviceType: PostResultServiceType; enabled: boolean }[]) =>
            setEnabledServices(
              rows.filter((row) => row.enabled).map((row) => row.serviceType),
            ),
          ),
      ]);
      setLoading(false);
    }
    init();
  }, [windowId, filterCandidateId, filterStatus, filterServiceType]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/review-windows/${windowId}/review-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          serviceType,
          priority,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to create request");
      }

      setCandidateId("");
      setNotes("");
      setPriority(false);
      await loadRequests();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <ReviewWindowDetailShell
      windowId={windowId}
      basePath={basePath}
      feeStatementsBasePath={feeStatementsBasePath}
    >
      <div className="space-y-6">
        <div className="grid gap-3 border border-slate-200 bg-white p-4 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Filter candidate</span>
            <select
              value={filterCandidateId}
              onChange={(e) => setFilterCandidateId(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
            >
              <option value="">All</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.englishName} ({candidate.assessmentHubCandidateNumber})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Filter service</span>
            <select
              value={filterServiceType}
              onChange={(e) => setFilterServiceType(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
            >
              <option value="">All</option>
              {enabledServices.map((type) => (
                <option key={type} value={type}>
                  {postResultServiceLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Filter status</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
            >
              <option value="">All</option>
              {REVIEW_REQUEST_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <form
          onSubmit={handleCreate}
          className="space-y-4 border border-slate-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">Create review request</h2>
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Candidate</span>
              <select
                required
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2"
              >
                <option value="">Select candidate</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.englishName} ({candidate.assessmentHubCandidateNumber})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Service type</span>
              <select
                required
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as PostResultServiceType)}
                className="w-full border border-slate-300 px-3 py-2"
              >
                {enabledServices.length === 0 ? (
                  <option value="">Enable services first</option>
                ) : (
                  enabledServices.map((type) => (
                    <option key={type} value={type}>
                      {postResultServiceLabel(type)}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={priority}
                onChange={(e) => setPriority(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="font-medium text-slate-700">Priority</span>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={creating || enabledServices.length === 0}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create request"}
          </button>
        </form>

        <div className="border border-slate-200 bg-white">
          {loading ? (
            <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No review requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Candidate</th>
                    <th className="px-4 py-2">Service</th>
                    <th className="px-4 py-2">Subject</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        {row.candidate?.englishName ?? "—"}
                        <span className="block text-xs text-slate-500">
                          {row.candidate?.assessmentHubCandidateNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {postResultServiceLabel(row.serviceType)}
                        {row.priority ? (
                          <span className="ml-2 text-xs text-amber-700">Priority</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {row.subject ? `${row.subject.code} · ${row.subject.name}` : "—"}
                      </td>
                      <td className="px-4 py-3">{reviewRequestStatusLabel(row.status)}</td>
                      <td className="px-4 py-3">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ReviewWindowDetailShell>
  );
}
