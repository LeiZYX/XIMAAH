"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { postResultServiceLabel, reviewRequestStatusLabel } from "@/lib/post-results/constants";

interface ReviewRequestRow {
  id: string;
  serviceType: string;
  status: string;
  createdAt: string;
  reviewWindow?: { id: string; title: string };
  candidate?: { englishName: string; assessmentHubCandidateNumber: string };
}

interface GlobalReviewRequestsListProps {
  reviewWindowsBasePath: "/admin/review-windows" | "/exam-office/review-windows";
}

export function GlobalReviewRequestsList({
  reviewWindowsBasePath,
}: GlobalReviewRequestsListProps) {
  const [windows, setWindows] = useState<{ id: string; title: string }[]>([]);
  const [requests, setRequests] = useState<ReviewRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const windowsResponse = await fetch("/api/review-windows");
      const windowRows = windowsResponse.ok ? await windowsResponse.json() : [];
      setWindows(windowRows);

      const allRequests: ReviewRequestRow[] = [];
      for (const window of windowRows) {
        const response = await fetch(`/api/review-windows/${window.id}/review-requests`);
        if (!response.ok) continue;
        const rows = await response.json();
        allRequests.push(
          ...rows.map((row: ReviewRequestRow) => ({
            ...row,
            reviewWindow: { id: window.id, title: window.title },
          })),
        );
      }

      allRequests.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setRequests(allRequests);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Requests"
        description="All review requests across review windows. Create new requests from a review window detail page."
      />

      <div className="border border-slate-200 bg-white">
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No review requests yet.{" "}
            <Link href={reviewWindowsBasePath} className="text-indigo-600 hover:underline">
              Open a review window
            </Link>{" "}
            to create one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Review window</th>
                  <th className="px-4 py-2">Candidate</th>
                  <th className="px-4 py-2">Service</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {row.reviewWindow ? (
                        <Link
                          href={`${reviewWindowsBasePath}/${row.reviewWindow.id}/review-requests`}
                          className="text-indigo-600 hover:underline"
                        >
                          {row.reviewWindow.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{row.candidate?.englishName ?? "—"}</td>
                    <td className="px-4 py-3">{postResultServiceLabel(row.serviceType)}</td>
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
  );
}
