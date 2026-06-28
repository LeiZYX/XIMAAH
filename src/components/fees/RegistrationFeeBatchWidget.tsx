"use client";

import { useEffect, useState } from "react";
import { FeeStatementsBatchPanel } from "@/components/fees/FeeStatementsBatchPanel";

interface RegistrationWindowOption {
  id: string;
  title: string;
  status: string;
}

interface RegistrationFeeBatchWidgetProps {
  feeRulesBasePath: "/admin/registration-windows" | "/exam-office/registration-windows";
}

export function RegistrationFeeBatchWidget({
  feeRulesBasePath,
}: RegistrationFeeBatchWidgetProps) {
  const [windows, setWindows] = useState<RegistrationWindowOption[]>([]);
  const [selectedWindowId, setSelectedWindowId] = useState("");

  useEffect(() => {
    fetch("/api/registration-windows")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setWindows(list);
        if (list.length > 0) setSelectedWindowId(list[0].id);
      })
      .catch(() => setWindows([]));
  }, []);

  if (windows.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">
          Registration window
          <select
            value={selectedWindowId}
            onChange={(e) => setSelectedWindowId(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {windows.map((window) => (
              <option key={window.id} value={window.id}>
                {window.title} ({window.status})
              </option>
            ))}
          </select>
        </label>
      </div>
      {selectedWindowId ? (
        <FeeStatementsBatchPanel
          registrationWindowId={selectedWindowId}
          feeRulesHref={`${feeRulesBasePath}/${selectedWindowId}/fees`}
        />
      ) : null}
    </div>
  );
}
