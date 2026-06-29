"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { auditActionLabel } from "@/lib/registrations/audit-labels";
import { entryTypeLabel } from "@/lib/registrations/stage-labels";

interface AuditRow {
  id: string;
  action: string;
  performedAt: string;
  reason: string | null;
  note: string | null;
  entryType: string | null;
  performedBy: { name: string; role: string } | null;
  registrationStage?: { stageName: string; stageCode: string } | null;
  feeStage: { stageName: string; stageCode: string } | null;
}

interface RegistrationWindowAuditLogProps {
  windowId: string;
}

export function RegistrationWindowAuditLog({ windowId }: RegistrationWindowAuditLogProps) {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/registration-windows/${windowId}/audit-log`);
    if (res.ok) {
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, [windowId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="overflow-x-auto">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Audit log</h2>
      {loading ? (
        <p className="text-sm text-slate-600">Loading audit log…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-600">No audit entries for this registration window yet.</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Entry stage</th>
              <th className="py-2 pr-4">Performed by</th>
              <th className="py-2 pr-4">Reason / note</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 whitespace-nowrap">
                  {new Date(log.performedAt).toLocaleString()}
                </td>
                <td className="py-2 pr-4">{auditActionLabel(log.action)}</td>
                <td className="py-2 pr-4">
                  {log.feeStage?.stageName ??
                    log.registrationStage?.stageName ??
                    (log.entryType ? entryTypeLabel(log.entryType) : "—")}
                </td>
                <td className="py-2 pr-4">
                  {log.performedBy ? `${log.performedBy.name} (${log.performedBy.role})` : "—"}
                </td>
                <td className="py-2 pr-4">{log.reason ?? log.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
