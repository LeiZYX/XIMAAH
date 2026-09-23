"use client";

import { useCallback, useEffect, useState } from "react";
import { StudentRegistrationGroups } from "@/components/registrations/StudentRegistrationGroups";
import { StudentCieRegistrationPanel } from "@/components/registrations/StudentCieRegistrationPanel";
import type { StudentRegistrationRow } from "@/lib/registrations/student-groups";

export function StudentRegistrationsClient() {
  const [registrations, setRegistrations] = useState<StudentRegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/registrations/me");
      if (!response.ok) throw new Error("Failed to load registrations");
      const data = await response.json();
      setRegistrations(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load registrations.");
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRemove(id: string) {
    setActionId(id);
    setError(null);
    try {
      const response = await fetch(`/api/registrations/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not remove exam");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove exam");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <StudentCieRegistrationPanel onChanged={() => void load()} />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : (
        <StudentRegistrationGroups
          registrations={registrations}
          actionId={actionId}
          onRemove={handleRemove}
          onRefresh={load}
        />
      )}
    </div>
  );
}
